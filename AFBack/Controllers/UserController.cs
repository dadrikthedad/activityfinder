using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Text.Json;
using AFBack.Constants;
using AFBack.DTOs.Auth;
using AFBack.Extensions;
using Microsoft.AspNetCore.Authorization;

namespace AFBack.Controllers;
using Microsoft.AspNetCore.Mvc;
using AFBack.DTOs;
using AFBack.Models;
using BCrypt.Net;
using System.Threading.Tasks;
using AFBack.Data;
using Microsoft.EntityFrameworkCore;
using AFBack.Services;
using CountryData.Standard;


// Forteller backend at alle API-endepunktene i denne klassen skal ha api/user som base-url
[Route("api/user")]
// Gjør klassen til en API-kontroller, automatisk sjekk at det er riktig input, automatisk konvertering JSON-requests til objekter.
[ApiController]
public class UserController : BaseController
{
    
   
    // Egenskapen for å koble oss til databasen, settes kun engang i konstruktøren
    private readonly ApplicationDbContext _context;
    // Loggeren
    private readonly ILogger<UserController> _logger;
    // Lager token og sjekker at passord og epost er riktig.
    private readonly AuthService _authService;
    private readonly CountryService _countryService;
    private readonly IBackgroundTaskQueue _taskQueue;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly EmailService _emailService;

    // Konstruktøren. Lagrer context som en variabel og countryHelperen som en variabel. Kommer fra CountryData.Standard. Loggeren og authService.
    public UserController(ApplicationDbContext context, ILogger<UserController> logger, AuthService authService, CountryService countryService, IBackgroundTaskQueue taskQueue, IServiceScopeFactory scopeFactory, EmailService emailService)
    {
        _context = context;
        _countryService = countryService;
        _logger = logger;
        _authService = authService;
        _taskQueue = taskQueue;
        _scopeFactory = scopeFactory;
        _emailService = emailService;
    }
    
    // Henter alle land:
    [HttpGet("countries")]
    public IActionResult GetAllCountries()
    {
        try
        {
            var countries = _countryService.GetAllCountries().ToList();

            if (!countries.Any())
            {
                _logger.LogWarning("No countries found.");
                return NotFound(new { message = "No countries available." });
            }

            return Ok(countries);
        }
        catch (Exception ex)
        {
            _logger.LogError("Error retrieving countries: {Error}", ex.Message);
            return StatusCode(500, new { message = "Failed to fetch countries." });
        }
    }
    
    
    
    // Endepunkt som blir sendt fra frontend basert på valgt land og sender tilbake en liste med alle regionene til valgt land
    [HttpGet("regions/{countryCode}")]
    public IActionResult GetRegionsByCountry(string countryCode)
    {
        if (string.IsNullOrWhiteSpace(countryCode))
            return BadRequest(new { message = "Country code is required." });

        try
        {
            var regions = _countryService.GetRegionsByCountryCode(countryCode);

            if (!regions.Any())
            {
                _logger.LogInformation("Ingen regioner funnet for {Code}", countryCode);
                return Ok(new List<string>());
            }

            return Ok(regions);
        }
        catch (Exception e)
        {
            _logger.LogError("Feil ved henting av regioner for {Code}: {Error}", countryCode, e.Message);
            return StatusCode(500, new { message = "Kunne ikke hente regioner. Prøv igjen senere." });
        }
    }
    
    
    // Brukes til å fortelle at denne metoden skal håndtere POST-requests fra url med api/user/register
    [HttpPost("register")]
    // Async kjører asynkront, slik at den ikke blokkerer hovedtråden. Dette er viktig når vi jobber med databaser, da det kan ta tid å hente og lagre data.
    // Task betyr at metoden er asynkron og vil returnere en verdi i fremtiden. IActionResult er typen returverdi, som betyr at vi returnerer en HTTP-respons.
    // FromBody betyr at vi skal hente data fra HTTP-requesten sin body, som da er JSON-formate.
    // UserRegisterDTO er klassen vi har laget som bekrefter igjen at all dataen er riktig og oppretter et objekt.
   public async Task<IActionResult> RegisterUser([FromBody] UserRegisterDTO userDto)
    {
        try
        {
            _logger.LogInformation("Registering user with data: {@UserDto}", userDto);
       
            var countryName = _countryService.GetCountryNameFromCode(userDto.Country);
            if (countryName is null)
            {
                ModelState.AddModelError("Country", $"Invalid country code: '{userDto.Country}'");
            }
            else
            {
                userDto.Country = countryName;
            }
        
            if (!ModelState.IsValid)
            {   
                var errors = ModelState.ToDictionary(kvp => kvp.Key,
                    kvp => kvp.Value.Errors.Select(error => error.ErrorMessage).ToList());

                _logger.LogWarning("Validation failed for user registration. Errors: {@Errors}", errors);
                return BadRequest(new {message = $"Validation failed. Check errors.", errors});
            }
        
            // *** GENERER TOKENS UTENFOR TRANSACTION ***
            var longToken = Guid.NewGuid().ToString();
            var shortCode = new Random().Next(100000, 999999).ToString();
            
            User savedUser;
            
            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {   
                    if (userDto.DateOfBirth > DateTime.UtcNow)
                    {
                        return BadRequest(new { message = "Date of birth cannot be in the future." });
                    }
                
                    if (string.Equals(userDto.Region, "No regions available", StringComparison.OrdinalIgnoreCase))
                    {
                        userDto.Region = null;
                    }
                
                    string hashedPassword = BCrypt.HashPassword(userDto.Password);
                
                    if (userDto.Gender.HasValue && !Enum.IsDefined(typeof(Gender), userDto.Gender.Value))
                    {
                        return BadRequest(new { message = "Invalid gender value." });
                    }
                
                    var user = new User
                    {
                        FirstName = userDto.FirstName,
                        MiddleName = userDto.MiddleName,
                        LastName = userDto.LastName,
                        Email = userDto.Email.Trim().ToLowerInvariant(),
                        PasswordHash = hashedPassword,
                        Phone = userDto.Phone,
                        DateOfBirth = DateTime.SpecifyKind(userDto.DateOfBirth, DateTimeKind.Utc),
                        CreatedAt = DateTime.UtcNow,
                        Country = userDto.Country,
                        Region = string.IsNullOrWhiteSpace(userDto.Region) ? null : userDto.Region,
                        PostalCode = userDto.PostalCode,
                        Gender = userDto.Gender,
                        EmailConfirmationToken = longToken,
                        EmailConfirmationCode = shortCode,
                        EmailConfirmed = false
                    };

                    user.UpdateFullName();
                
                    var profile = new Profile
                    {
                        User = user,
                        UserId = user.Id,
                        UpdatedAt = DateTime.UtcNow,
                    };
                
                    var settings = new UserSettings
                    {
                        User = user,
                        UserId = user.Id,
                    };

                    await _context.Users.AddAsync(user);
                    await _context.Profiles.AddAsync(profile);
                    await _context.UserSettings.AddAsync(settings);
                    await _context.SaveChangesAsync();

                    // *** COMMIT TRANSACTION FØR EMAIL-SENDING ***
                    await transaction.CommitAsync();
                    
                    // Store user reference for later use
                    savedUser = user;
                }
                catch (DbUpdateException e)
                {
                    await transaction.RollbackAsync();

                    if (e.InnerException is Npgsql.PostgresException postgresException && 
                        postgresException.SqlState == "23505")
                    {
                        _logger.LogWarning("Duplicate email detected: {Email}", userDto.Email);
                        return BadRequest(new { message = "Email is already registered." });
                    }

                    _logger.LogError("Error saving user: {Error}", e.Message);
                    return StatusCode(500, new { message = "An error occured while saving the user." });
                }
                catch (Exception e)
                {
                    await transaction.RollbackAsync();
                    _logger.LogError("Database connection failed: {Error}", e.Message);
                    return StatusCode(500, new { message = "Database connection error. Please try again later." });
                }
            } // *** TRANSACTION ER NÅ FERDIG OG DISPOSED ***

            // *** SEND EMAIL ETTER TRANSACTION ER FULLFØRT ***
            bool emailSent = false;
            try
            {
                emailSent = await _emailService.SendVerificationEmailAsync(savedUser.Email, longToken, shortCode);
                
                if (emailSent)
                {
                    _logger.LogInformation("Verification email sent successfully to {Email}", savedUser.Email);
                }
                else
                {
                    _logger.LogWarning("Failed to send verification email to {Email}", savedUser.Email);
                }
            }
            catch (Exception emailEx)
            {
                _logger.LogError("Error sending verification email to {Email}: {Error}", savedUser.Email, emailEx.Message);
                // Email failure should not fail the registration
            }
            
            // *** RETURNER ALLTID SUKSESS ***
            return Ok(new
            {
                message = "Registration successful! We've sent a verification email with both a clickable link and a 6-digit code. Use either method to verify your account.",
                userId = savedUser.Id,
                email = savedUser.Email,
                emailConfirmationRequired = true,
                verificationMethods = new 
                {
                    webLink = "Check your email and click the verification link",
                    mobileCode = "Enter the 6-digit code shown in the email into the app",
                    deepLink = "Click 'Open in App' from the email if using mobile"
                }
            });
        }
        catch (Exception e)
        {
            _logger.LogWarning("Unhandled error: {Error}", e.Message);
            return StatusCode(500, new { message = $"{e.Message} Unexpected server error." });
        }
    }
    
    // Her sjekker vi at brukeren 
    public async Task<IActionResult> Login([FromBody] UserLoginDTO userLoginDto)
    {
        if (!ModelState.IsValid)
            return BadRequest(new { message = "Invalid login requests." });
    
        string normalizedEmail = userLoginDto.Email.Trim().ToLowerInvariant();
    
        var token = await _authService.LoginAsync(normalizedEmail, userLoginDto.Password);
    
        if (token == null)
        {
            _logger.LogWarning("Failed login attempt for email: {Email}", userLoginDto.Email);
            return Unauthorized(new { message = "Invalid email or password." });
        }
    
        // *** HÅNDTER UVERIFISERT EPOST ***
        if (token == "EMAIL_NOT_VERIFIED")
        {
            return Unauthorized(new { 
                message = "Please verify your email address before logging in. Check your inbox for the verification link.",
                emailVerificationRequired = true,
                email = normalizedEmail
            });
        }

        try
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail);
            if (user != null)
            {
                user.LastLoginIp = userLoginDto.Ip;
                user.LastLoginCity = userLoginDto.City;
                user.LastLoginRegion = userLoginDto.Region;
                user.LastLoginCountry = userLoginDto.Country;
                user.LastSeen = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
        
            _logger.LogInformation("Successful login for user: {Email}", userLoginDto.Email);
        }
        catch (Exception e)
        {
            _logger.LogWarning("Could not save login location for {Email}: {Error}", userLoginDto.Email, e.Message);
        }

        return Ok(new { 
            token,
            message = "Login successful"
        });
    }
    
    
    // Sjekker at epost ikke er brukt tidligere
    [HttpGet("check-email")]
    public async Task<IActionResult> CheckEmailAvailability([FromQuery] string email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return BadRequest(new { message = "Email can't be empty." });
        }

        try
        {
            string normalizedEmail = email.Trim().ToLowerInvariant();
            
            bool emailExists = await _context.Users.AnyAsync(user => user.Email == normalizedEmail);

            return Ok(new { exists = emailExists });
        }
        catch (Exception e)
        {
            _logger.LogError("Error while checking email: {Error}", e.Message);
            return StatusCode(500, new { message = "Database error. Try again later." });
        }
    }
    
    // Henter informasjonen fra UserDTO for å vise epost på securitycred siden. Kan brukes senere til å vise info lett og greit, kanskje senere på andre sider
    // GUL Advarsel - Alt annet enn UserId, Email og Passord brukes ikke her eller i USerDTO
    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> GetCurrentUser()
    {
        {
            if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
            {
                return Unauthorized(new { message = "Invalid user ID in token." });
            }
        
            var user = await _context.Users.FindAsync(userId);
            
            if (user == null)
                return NotFound(new { message = "User not found." });

            var dto = new UserDTO
            {
                UserId = user.Id,
                FullName = user.FullName,
                Email = user.Email,
                DateOfBirth = user.DateOfBirth,
                Phone = user.Phone,
                Country = user.Country,
                Region = user.Region,
                PostalCode = user.PostalCode,
                Gender = user.Gender
            };

            return Ok(dto);
        }
    }
   
    
    // Henter informasjonen fra databasen til å vise på profil-siden
    [HttpGet("profilesettings")]
    [Authorize]
    public async Task<IActionResult> GetUserSettings()
    {
            if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
            {
                return Unauthorized(new { message = "Invalid user ID in token." });
            }
        
            var user = await _context.Users.FindAsync(userId);
            
            if (user == null)
                return NotFound(new { message = "User not found." });

            var dto = new UserProfileSettingDTO
            {
                FirstName = user.FirstName,
                MiddleName = user.MiddleName,
                LastName = user.LastName,
                Phone = user.Phone,
                Country = user.Country,
                Region = user.Region,
                PostalCode = user.PostalCode,
                Gender = user.Gender
            };

            return Ok(dto);
    }
    
    
    // Små patcher som brukes til å endre feltene fra brukeren
    // Patch for profilesettings sin endring av fornavn
    [HttpPatch("first-name")]
    [Authorize]
    public async Task<IActionResult> UpdateFirstName([FromBody] UpdateFirstNameDTO dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);
        
        var user = await GetUserFromClaims();
        if (user == null) return Unauthorized();

        user.FirstName = dto.FirstName;
        user.UpdateFullName();
        
        await _context.SaveChangesAsync();
        
        // Notify friends and blockers
        UserSummaryExtensions.NotifyFriendsAndBlockersOfProfileUpdate(
            _taskQueue,
            _scopeFactory,
            user.Id, 
            new List<string> { "fullName" },
            new Dictionary<string, object> 
            { 
                ["fullName"] = user.FullName 
            }
        );
        return Ok(new { message = "First name updated." });
    }
    // Patch for profilesettings sin endring av mellomnavn
    [HttpPatch("middle-name")]
    [Authorize]
    public async Task<IActionResult> UpdateMiddleName([FromBody] UpdateMiddleNameDTO dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);
        
        var user = await GetUserFromClaims();
        if (user == null) return Unauthorized();

        user.MiddleName = dto.MiddleName;
        user.UpdateFullName();
        
        await _context.SaveChangesAsync();
        
        // Notify friends and blockers
        UserSummaryExtensions.NotifyFriendsAndBlockersOfProfileUpdate(
            _taskQueue,
            _scopeFactory,
            user.Id, 
            new List<string> { "fullName" },
            new Dictionary<string, object> 
            { 
                ["fullName"] = user.FullName 
            }
        );

        return Ok(new { message = "Middle name updated." });
    }
    // Patch for profilesettings sin endring av etternavn
    [HttpPatch("last-name")]
    [Authorize]
    public async Task<IActionResult> UpdateLastName([FromBody] UpdateLastNameDTO dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);
        
        var user = await GetUserFromClaims();
        if (user == null) return Unauthorized();

        user.LastName = dto.LastName;
        user.UpdateFullName();
        
        await _context.SaveChangesAsync();
        
        UserSummaryExtensions.NotifyFriendsAndBlockersOfProfileUpdate(
            _taskQueue,
            _scopeFactory,
            user.Id, 
            new List<string> { "fullName" },
            new Dictionary<string, object> 
            { 
                ["fullName"] = user.FullName 
            }
        );

        return Ok(new { message = "Last name updated." });
    }
    
    
    // Patch for profilesettings sin endring av telefon
    [HttpPatch("phone")]
    [Authorize]
    public async Task<IActionResult> UpdatePhone([FromBody] UpdatePhoneDTO dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);
        
        var user = await GetUserFromClaims();
        if (user == null) return Unauthorized();

        user.Phone = string.IsNullOrWhiteSpace(dto.Phone) ? null : dto.Phone.Trim();
        await _context.SaveChangesAsync();

        return Ok(new { message = "Phone updated." });
    }
    // Patch for profilesettings sin endring av land og region
    [HttpPatch("location")]
    [Authorize]
    public async Task<IActionResult> UpdateLocation([FromBody] UpdateLocationDTO dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var user = await GetUserFromClaims();
        if (user == null) return Unauthorized();

        // Valider land
        var countryName = _countryService.GetCountryNameFromCode(dto.Country);
        if (countryName == null)
        {
            return BadRequest(new { message = "Invalid country code." });
        }

        user.Country = countryName;
        user.Region = dto.Region;

        await _context.SaveChangesAsync();

        return Ok(new { message = "Location updated." });
    }
    // Patch for profilesettings sin endring av postkode
    [HttpPatch("postalcode")]
    [Authorize]
    public async Task<IActionResult> UpdatePostalCode([FromBody] UpdatePostalCodeDTO dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);
        
        var user = await GetUserFromClaims();
        if (user == null) return Unauthorized();

        user.PostalCode = dto.PostalCode;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Postal code updated." });
    }
    // Patch for profilesettings sin endring av kjønn
    [HttpPatch("gender")]
    [Authorize]
    public async Task<IActionResult> UpdateGender([FromBody] UpdateGenderDTO dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);
        
        var user = await GetUserFromClaims();
        if (user == null) return Unauthorized();

        user.Gender = dto.Gender;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Gender updated." });
    }

    private async Task<User?> GetUserFromClaims()
    {
        
        if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
            return null;

        return await _context.Users.FindAsync(userId);
    }
    
    // Patch for securitycred sin endring av epost
    [HttpPatch("email")]
    [Authorize]
    public async Task<IActionResult> UpdateEmail([FromBody] UpdateEmailDTO dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);
        
        var user = await GetUserFromClaims();
        if (user == null) return Unauthorized();
        
        if (!BCrypt.Verify(dto.CurrentPassword, user.PasswordHash))
        {
            return Unauthorized(new { message = "Current password is incorrect." });
        }

        if (await _context.Users.AnyAsync(u => u.Email == dto.NewEmail && u.Id != user.Id))
        {
            return BadRequest(new { message = "This email is already in use." });
        }

        user.Email = dto.NewEmail.Trim().ToLowerInvariant();
        await _context.SaveChangesAsync();

        return Ok(new { message = "Email updated.", newEmail = user.Email });
    }
    // Patch for securitycred sin endring av passord
    [HttpPatch("password")]
    [Authorize]
    public async Task<IActionResult> UpdatePassword([FromBody] UpdatePasswordDTO dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);
        
        var user = await GetUserFromClaims();
        if (user == null) return Unauthorized();

        // Sjekk om passordet stemmer
        if (!BCrypt.Verify(dto.CurrentPassword, user.PasswordHash))
        {
            return Unauthorized(new { message = "Current password is incorrect." });
        }

        // Hash og lagre nytt passord
        user.PasswordHash = BCrypt.HashPassword(dto.NewPassword);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Password updated successfully." });
    }
    
    // Søke etter en bruker, brukes i søkebaren til navbar. Senere eventuelt lage en egen SearchController.cs feks
    [HttpGet("search")]
    public async Task<ActionResult<List<UserSummaryDTO>>> SearchUsers([FromQuery] string query)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return BadRequest("Query cannot be empty.");
        }

        var currentUserId = GetUserId(); // ✅ Kan være null hvis ikke innlogget

        // Normaliser søkestrengen
        var normalizedQuery = string.Join(" ", query
            .ToLower()
            .Split(' ', StringSplitOptions.RemoveEmptyEntries));

        List<int> blockedUserIds = new List<int>();

        // ✅ Kun hent blocked relationships hvis innlogget
        if (currentUserId.HasValue)
        {
            blockedUserIds = await _context.UserBlocks
                .Where(b => b.BlockerId == currentUserId || b.BlockedUserId == currentUserId)
                .Select(b => b.BlockerId == currentUserId ? b.BlockedUserId : b.BlockerId)
                .ToListAsync();
        }

        var results = await _context.Users
            .Where(u => 
                u.FullName.ToLower().Contains(normalizedQuery) &&
                (currentUserId == null || u.Id != currentUserId) && // ✅ Ekskluder seg selv bare hvis innlogget
                !blockedUserIds.Contains(u.Id)) // ✅ Tom liste hvis ikke innlogget
            .Select(u => new UserSummaryDTO
            {
                Id = u.Id,
                FullName = u.FullName,
                ProfileImageUrl = u.Profile != null ? u.Profile.ProfileImageUrl : null
            })
            .Take(20)
            .ToListAsync();

        return Ok(results);
    }
    
    [HttpGet("search/group-invite/{conversationId}")]
    public async Task<ActionResult<List<UserSummaryDTO>>> SearchUsersForGroupInvite(
    [FromRoute] int conversationId,
    [FromQuery] string query)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return BadRequest("Query cannot be empty.");
        }

        var currentUserId = GetUserId();
        
        if (currentUserId == null)
        {
            return Unauthorized();
        }

        var normalizedQuery = string.Join(" ", query
            .ToLower()
            .Split(' ', StringSplitOptions.RemoveEmptyEntries));

        // ✅ Hent blocked relationships
        var blockedUserIds = await _context.UserBlocks
            .Where(b => b.BlockerId == currentUserId || b.BlockedUserId == currentUserId)
            .Select(b => b.BlockerId == currentUserId ? b.BlockedUserId : b.BlockerId)
            .ToListAsync();

        var results = await _context.Users
            .Where(u => 
                u.FullName.ToLower().Contains(normalizedQuery) &&
                u.Id != currentUserId &&
                !blockedUserIds.Contains(u.Id) && // ✅ Ikke blocked users
                // Ikke eksisterende deltaker
                !_context.ConversationParticipants
                    .Any(cp => cp.ConversationId == conversationId && cp.UserId == u.Id) &&
                // Ikke rejected eller pending gruppeforespørsel
                !_context.GroupRequests
                    .Any(gr => gr.ConversationId == conversationId && 
                               gr.ReceiverId == u.Id &&
                               (gr.Status == GroupRequestStatus.Rejected || 
                                gr.Status == GroupRequestStatus.Pending)) &&
                // Sjekk at current user har tilgang (sikkerhet)
                _context.ConversationParticipants
                    .Any(cp => cp.ConversationId == conversationId && cp.UserId == currentUserId))
            .Select(u => new UserSummaryDTO
            {
                Id = u.Id,
                FullName = u.FullName,
                ProfileImageUrl = u.Profile != null ? u.Profile.ProfileImageUrl : null
            })
            .Take(20)
            .ToListAsync();

        return Ok(results);
    }
    
}