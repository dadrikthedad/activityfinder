using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Text.Json;
using AFBack.Constants;
using AFBack.DTOs.Auth;
using AFBack.Extensions;
using AFBack.Features.Auth.Models;
using AFBack.Features.Cache;
using AFBack.Features.Cache.Interface;
using AFBack.Features.Geography.Services;
using AFBack.Infrastructure.Security.Utils;
using AFBack.Infrastructure.Services;
using AFBack.Interface.Services;
using AFBack.Models.User;
using AFBack.Services.User;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;

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


// Forteller backend at alle API-endepunktene i denne klassen skal ha api/appUser som base-url
[Route("api/appUser")]
// Gjør klassen til en API-kontroller, automatisk sjekk at det er riktig input, automatisk konvertering JSON-requests til objekter.
[ApiController]
public class UserController(
    AppDbContext context,
    ILogger<UserController> logger,
    OldAuthService oldAuthService,
    CountryService countryService,
    IBackgroundTaskQueue taskQueue,
    IServiceScopeFactory scopeFactory,
    EmailService emailService,
    UserService userService,
    EmailRateLimitService emailRateLimitService,
    IIpBanService ipBanService,
    GeolocationService geolocationService,
    IUserCache userCache,
    ResponseService responseService)
    : BaseController<UserController>(context, logger, userCache, responseService)
{
    // Lager token og sjekker at passord og epost er riktig.

    // Konstruktøren. Lagrer context som en variabel og countryHelperen som en variabel. Kommer fra CountryData.Standard. Loggeren og authService.

    // Henter alle land:
    [HttpGet("countries")]
    public async Task<IActionResult> GetAllCountries()
    {
        // Enkel IP-ban sjekk

        try
        {
            var countries = countryService.GetAllCountries().ToList();

            if (!countries.Any())
            {
                Logger.LogWarning("No countries found.");
                return NotFound(new { message = "No countries available." });
            }

            return Ok(countries);
        }
        catch (Exception ex)
        {
            Logger.LogError("Error retrieving countries: {Error}", ex.Message);
            return StatusCode(500, new { message = "Failed to fetch countries." });
        }
    }

    [HttpGet("regions/{countryCode}")]
    public async Task<IActionResult> GetRegionsByCountry(string countryCode)
    {
        
        if (string.IsNullOrWhiteSpace(countryCode))
            return BadRequest(new { message = "Country code is required." });

        try
        {
            var regions = countryService.GetRegionsByCountryCode(countryCode);

            if (!regions.Any())
            {
                Logger.LogInformation("Ingen regioner funnet for {Code}", countryCode);
                return Ok(new List<string>());
            }

            return Ok(regions);
        }
        catch (Exception e)
        {
            Logger.LogError("Feil ved henting av regioner for {Code}: {Error}", countryCode, e.Message);
            return StatusCode(500, new { message = "Kunne ikke hente regioner. Prøv igjen senere." });
        }
    }
    
    
    // Brukes til å fortelle at denne metoden skal håndtere POST-requests fra url med api/appUser/register
    [HttpPost("register")]
    // Async kjører asynkront, slik at den ikke blokkerer hovedtråden. Dette er viktig når vi jobber med databaser, da det kan ta tid å hente og lagre data.
    // Task betyr at metoden er asynkron og vil returnere en verdi i fremtiden. IActionResult er typen returverdi, som betyr at vi returnerer en HTTP-respons.
    // FromBody betyr at vi skal hente data fra HTTP-requesten sin body, som da er JSON-formate.
    // UserRegisterDTO er klassen vi har laget som bekrefter igjen at all dataen er riktig og oppretter et objekt.
   public async Task<IActionResult> RegisterUser([FromBody] UserRegisterDTO userDto)
    {
        try
        {

            Logger.LogInformation("Registering appUser with data: {@UserDto}", userDto);
       
            var countryName = countryService.GetCountryNameFromCode(userDto.Country);
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

                Logger.LogWarning("Validation failed for appUser registration. Errors: {@Errors}", errors);
                
                // *** RAPPORTER MISTENKELIG AKTIVITET MED EXTENSION ***
                await this.ReportSuspiciousActivityAsync(
                    ipBanService, 
                    SuspiciousActivityTypes.REGISTRATION_VALIDATION_FAILED, 
                    $"Registration validation failed: {string.Join(", ", errors.Values.SelectMany(v => v))}",
                    Logger);
                
                return BadRequest(new {message = $"Validation failed. Check errors.", errors});
            }
        
            // *** GENERER TOKENS UTENFOR TRANSACTION ***
            var longToken = Guid.NewGuid().ToString();
            var shortCode = new Random().Next(100000, 999999).ToString();
            
            AppUser savedAppUser;
            
            using (var transaction = await Context.Database.BeginTransactionAsync())
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
                
                    var user = new AppUser
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
                        EmailConfirmed = false
                    };

                    // Opprett VerificationInfo separat
                    var verificationInfo = new VerificationInfo
                    {
                        AppUser = user,
                        EmailConfirmationToken = longToken,
                        EmailConfirmationCode = shortCode,
                        LastVerificationEmailSent = DateTime.UtcNow,
                        EmailConfirmationTokenExpires = DateTime.UtcNow.AddHours(1)
                    };

                    user.UpdateFullName();
                
                    var profile = new UserProfile
                    {
                        AppUser = user,
                        UpdatedAt = DateTime.UtcNow,
                    };
                
                    var settings = new UserSettings
                    {
                        AppUser = user,
                    };

                    await Context.Users.AddAsync(user);
                    await Context.Profiles.AddAsync(profile);
                    await Context.UserSettings.AddAsync(settings);
                    await Context.VerificationInfos.AddAsync(verificationInfo);
                    await Context.SaveChangesAsync();

                    // *** COMMIT TRANSACTION FØR EMAIL-SENDING ***
                    await transaction.CommitAsync();
                    
                    // Store appUser reference for later use
                    savedAppUser = user;
                }
                catch (DbUpdateException e)
                {
                    await transaction.RollbackAsync();

                    if (e.InnerException is Npgsql.PostgresException postgresException && 
                        postgresException.SqlState == "23505")
                    {
                        Logger.LogWarning("Duplicate email detected: {Email}", userDto.Email);
                        
                        // *** RAPPORTER MISTENKELIG AKTIVITET MED EXTENSION ***
                        await this.ReportSuspiciousActivityAsync(
                            ipBanService, 
                            SuspiciousActivityTypes.DUPLICATE_EMAIL_REGISTRATION, 
                            $"Attempted registration with existing email: {userDto.Email}",
                            Logger);
                        
                        return BadRequest(new { message = "Email is already registered." });
                    }

                    Logger.LogError("Error saving appUser: {Error}", e.Message);
                    return StatusCode(500, new { message = "An error occured while saving the appUser." });
                }
                catch (Exception e)
                {
                    await transaction.RollbackAsync();
                    Logger.LogError("Database connection failed: {Error}", e.Message);
                    return StatusCode(500, new { message = "Database connection error. Please try again later." });
                }
            } // *** TRANSACTION ER NÅ FERDIG OG DISPOSED ***

            // *** SEND EMAIL ETTER TRANSACTION ER FULLFØRT ***
            bool emailSent = false;
            try
            {
                emailSent = await emailService.SendVerificationEmailAsync(savedAppUser.Email, longToken, shortCode);

                if (emailSent)
                {
                    // Registrer for rate limiting (samme som i EmailController)
                    emailRateLimitService.RegisterVerificationEmailSent(savedAppUser.Email);
        
                    // Oppdater UserService timestamp
                    await userService.MarkVerificationEmailSentAsync(savedAppUser.Email);
        
                    Logger.LogInformation("Verification email sent successfully to {Email}", savedAppUser.Email);
                }
                else
                {
                    Logger.LogWarning("Failed to send verification email to {Email}", savedAppUser.Email);
                    
                    // *** RAPPORTER MISTENKELIG AKTIVITET MED EXTENSION ***
                    await this.ReportSuspiciousActivityAsync(
                        ipBanService, 
                        SuspiciousActivityTypes.VERIFICATION_EMAIL_FAILED, 
                        $"Failed to send verification email to: {savedAppUser.Email}",
                        Logger);
                }
            }
            catch (Exception emailEx)
            {
                Logger.LogError("Error sending verification email to {Email}: {Error}", savedAppUser.Email, emailEx.Message);
                // Email failure should not fail the registration
                
                // *** RAPPORTER MISTENKELIG AKTIVITET MED EXTENSION ***
                await this.ReportSuspiciousActivityAsync(
                    ipBanService, 
                    SuspiciousActivityTypes.VERIFICATION_EMAIL_ERROR, 
                    $"Exception sending verification email to: {savedAppUser.Email} - {emailEx.Message}",
                    Logger);
            }
            
            // *** RETURNER ALLTID SUKSESS ***
            Logger.LogInformation("Successful registration for appUser: {Email}", savedAppUser.Email);
            
            return Ok(new
            {
                message = "Registration successful! We've sent a verification email with both a clickable link and a 6-digit code. Use either method to verify your account.",
                userId = savedAppUser.Id,
                email = savedAppUser.Email,
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
            Logger.LogWarning("Unhandled error: {Error}", e.Message);
            return StatusCode(500, new { message = $"{e.Message} Unexpected server error." });
        }
    }
    
    
    // Her sjekker vi at brukeren 
    [HttpPost("login")]
    [EnableRateLimiting("auth")] // ⬅️ Legg til policy
    public async Task<IActionResult> Login([FromBody] UserLoginDTO userLoginDto)
    {
        if (!ModelState.IsValid)
            return BadRequest(new { message = "Invalid login request." });

        string normalizedEmail = userLoginDto.Email.Trim().ToLowerInvariant();

        var loginResponse = await oldAuthService.LoginAsync(normalizedEmail, userLoginDto.Password);

        if (loginResponse == null)
        {
            // Sjekk om det er uverifisert epost
            var existingUser = await Context.Users
                .FirstOrDefaultAsync(u => u.Email == normalizedEmail);

            if (existingUser != null && !existingUser.EmailConfirmed)
            {
                await this.ReportSuspiciousActivityAsync(
                    ipBanService, 
                    SuspiciousActivityTypes.UNVERIFIED_LOGIN_ATTEMPT, 
                    $"Login attempt with unverified email: {normalizedEmail}",
                    Logger);
        
                return Unauthorized(new { 
                    message = "Please verify your email address before logging in.",
                    emailVerificationRequired = true,
                    email = normalizedEmail
                });
            }

            // Feil login
            Logger.LogWarning("Failed login attempt for email: {Email}", userLoginDto.Email);

            await this.ReportSuspiciousActivityAsync(
                ipBanService, 
                SuspiciousActivityTypes.FAILED_LOGIN, 
                $"Failed login attempt for email: {normalizedEmail}",
                Logger);

            return Unauthorized(new { message = "Invalid email or password." });
        }

        // Oppdater brukerinfo ved vellykket login
        try
        {
            var user = await Context.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail);
            if (user != null)
            {
                var userId = user.Id;
                var clientIp = HttpContext.GetClientIpAddress(); // ⬅️ Hent IP direkte
                
                user.LastLoginIp = clientIp;
                user.LastSeen = DateTime.UtcNow;
                await Context.SaveChangesAsync();

                // Background geolocation update
                _ = Task.Run(async () =>
                {
                    try
                    {
                        var locationResult = await geolocationService.GetLocationAsync(clientIp);
            
                        if (locationResult.Success)
                        {
                            using var scope = scopeFactory.CreateScope();
                            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                
                            var userToUpdate = await context.AppUsers.FindAsync(userId);
                            if (userToUpdate != null)
                            {
                                userToUpdate.LastLoginCity = locationResult.City;
                                userToUpdate.LastLoginRegion = locationResult.Region;
                                userToUpdate.LastLoginCountry = locationResult.Country;
                                await context.SaveChangesAsync();
                    
                                Logger.LogDebug("Updated location for appUser {UserId}: {City}, {Region}, {Country}", 
                                    userId, locationResult.City, locationResult.Region, locationResult.Country);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        Logger.LogWarning("Background geolocation update failed for appUser {UserId}: {Error}", 
                            userId, ex.Message);
                    }
                });
            }
        }
        catch (Exception e)
        {
            Logger.LogWarning("Could not save login info for {Email}: {Error}", userLoginDto.Email, e.Message);
        }
        
        return Ok(loginResponse);
    }
    
    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] RefreshTokenRequestDTO request)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
            return Ok(new { message = "Logged out successfully" }); // Soft fail

        var success = await oldAuthService.LogoutAsync(request.RefreshToken);
    
        if (success)
        {
            Logger.LogInformation("AppUser logged out successfully");
        }
        else
        {
            Logger.LogWarning("Logout attempt with invalid token");
        }

        // Alltid returner success for å ikke avsløre token-status
        return Ok(new { message = "Logged out successfully" });
    }
    
    [HttpPost("refresh")]
    public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequestDTO request)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
            return BadRequest(new { message = "Refresh token is required" });

        var result = await oldAuthService.RefreshTokenAsync(request.RefreshToken);

        if (result == null)
        {
            Logger.LogWarning("Invalid refresh token attempt from IP: {IP}", 
                IpUtils.GetClientIp(HttpContext));
            return Unauthorized(new { message = "Invalid or expired refresh token" });
        }

        return Ok(result);
    }
    
    
    // Sjekker at epost ikke er brukt tidligere
    [HttpGet("check-email")]
    public async Task<IActionResult> CheckEmailAvailability([FromQuery] string email)
    {

        if (string.IsNullOrWhiteSpace(email))
        {
            await this.ReportSuspiciousActivityAsync(
                ipBanService,
                SuspiciousActivityTypes.API_ABUSE,
                "Email availability check with empty email",
                Logger);
                
            return BadRequest(new { message = "Email can't be empty." });
        }

        try
        {
            string normalizedEmail = email.Trim().ToLowerInvariant();
            
            // Sjekk for mistenkelige mønstre
            if (IpBanExtensions.IsSuspiciousEmailPattern(normalizedEmail))
            {
                await this.ReportSuspiciousActivityAsync(
                    ipBanService,
                    SuspiciousActivityTypes.API_ABUSE,
                    $"Suspicious email pattern detected: {normalizedEmail}",
                    Logger);
                    
                return BadRequest(new { message = "Invalid email format." });
            }
            
            if (!IpBanExtensions.IsValidEmail(normalizedEmail))
            {
                await this.ReportSuspiciousActivityAsync(
                    ipBanService,
                    SuspiciousActivityTypes.API_ABUSE,
                    $"Invalid email format in availability check: {normalizedEmail}",
                    Logger);
                    
                return BadRequest(new { message = "Invalid email format." });
            }
            
            bool emailExists = await Context.Users.AnyAsync(user => user.Email == normalizedEmail);

            return Ok(new { exists = emailExists });
        }
        catch (Exception e)
        {
            Logger.LogError("Error while checking email: {Error}", e.Message);
            
            await this.ReportSuspiciousActivityAsync(
                ipBanService,
                SuspiciousActivityTypes.API_ABUSE,
                $"Database error during email check: {e.Message}",
                Logger);
                
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
                return Unauthorized(new { message = "Invalid appUser ID in token." });
            }
        
            var user = await Context.Users.FindAsync(userId);
            
            if (user == null)
                return NotFound(new { message = "AppUser not found." });

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
                return Unauthorized(new { message = "Invalid appUser ID in token." });
            }
        
            var user = await Context.Users.FindAsync(userId);
            
            if (user == null)
                return NotFound(new { message = "AppUser not found." });

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
        
        await Context.SaveChangesAsync();
        
        // Notify friends and blockers
        UserSummaryExtensions.NotifyFriendsAndBlockersOfProfileUpdate(
            taskQueue,
            scopeFactory,
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
        
        await Context.SaveChangesAsync();
        
        // Notify friends and blockers
        UserSummaryExtensions.NotifyFriendsAndBlockersOfProfileUpdate(
            taskQueue,
            scopeFactory,
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
        
        await Context.SaveChangesAsync();
        
        UserSummaryExtensions.NotifyFriendsAndBlockersOfProfileUpdate(
            taskQueue,
            scopeFactory,
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
        await Context.SaveChangesAsync();

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
        var countryName = countryService.GetCountryNameFromCode(dto.Country);
        if (countryName == null)
        {
            return BadRequest(new { message = "Invalid country code." });
        }

        user.Country = countryName;
        user.Region = dto.Region;

        await Context.SaveChangesAsync();

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
        await Context.SaveChangesAsync();

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
        await Context.SaveChangesAsync();

        return Ok(new { message = "Gender updated." });
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

        if (await Context.Users.AnyAsync(u => u.Email == dto.NewEmail && u.Id != user.Id))
        {
            return BadRequest(new { message = "This email is already in use." });
        }

        user.Email = dto.NewEmail.Trim().ToLowerInvariant();
        await Context.SaveChangesAsync();

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
        await Context.SaveChangesAsync();

        return Ok(new { message = "Password updated successfully." });
    }
    
    // Søke etter en bruker, brukes i søkebaren til navbar. Senere eventuelt lage en egen SearchController.cs feks
    [HttpGet("search")]
    public async Task<ActionResult<List<UserSummaryDto>>> SearchUsers([FromQuery] string query)
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
            blockedUserIds = await Context.UserBlocks
                .Where(b => b.BlockerId == currentUserId || b.BlockedUserId == currentUserId)
                .Select(b => b.BlockerId == currentUserId ? b.BlockedUserId : b.BlockerId)
                .ToListAsync();
        }

        var results = await Context.Users
            .Where(u => 
                u.FullName.ToLower().Contains(normalizedQuery) &&
                (currentUserId == null || u.Id != currentUserId) && // ✅ Ekskluder seg selv bare hvis innlogget
                !blockedUserIds.Contains(u.Id)) // ✅ Tom liste hvis ikke innlogget
            .Select(u => new UserSummaryDto
            {
                Id = u.Id,
                FullName = u.FullName,
                ProfileImageUrl = u.ProfileImageUrl
            })
            .Take(20)
            .ToListAsync();

        return Ok(results);
    }
    
    [HttpGet("search/group-invite/{conversationId}")]
    public async Task<ActionResult<List<UserSummaryDto>>> SearchUsersForGroupInvite(
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
        var blockedUserIds = await Context.UserBlocks
            .Where(b => b.BlockerId == currentUserId || b.BlockedUserId == currentUserId)
            .Select(b => b.BlockerId == currentUserId ? b.BlockedUserId : b.BlockerId)
            .ToListAsync();

        var results = await Context.Users
            .Where(u => 
                u.FullName.ToLower().Contains(normalizedQuery) &&
                u.Id != currentUserId &&
                !blockedUserIds.Contains(u.Id) && // ✅ Ikke blocked users
                // Ikke eksisterende deltaker
                !Context.ConversationParticipants
                    .Any(cp => cp.ConversationId == conversationId && cp.UserId == u.Id) &&
                // Ikke rejected eller pending gruppeforespørsel
                !Context.GroupRequests
                    .Any(gr => gr.ConversationId == conversationId && 
                               gr.ReceiverId == u.Id &&
                               (gr.Status == GroupRequestStatus.Rejected || 
                                gr.Status == GroupRequestStatus.Pending)) &&
                // Sjekk at current appUser har tilgang (sikkerhet)
                Context.ConversationParticipants
                    .Any(cp => cp.ConversationId == conversationId && cp.UserId == currentUserId))
            .Select(u => new UserSummaryDto
            {
                Id = u.Id,
                FullName = u.FullName,
                ProfileImageUrl = u.ProfileImageUrl
            })
            .Take(20)
            .ToListAsync();

        return Ok(results);
    }
    
    [Authorize]
    [HttpPost("verify-password")]
    public async Task<IActionResult> VerifyPassword([FromBody] VerifyPasswordDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var user = await GetUserFromClaims();
        if (user == null)
            return Unauthorized("AppUser not found.");
            
        if (!BCrypt.Verify(dto.Password, user.PasswordHash))
        {
            return Unauthorized("Password is incorrect.");
        }

        return Ok();
    }
    
}
