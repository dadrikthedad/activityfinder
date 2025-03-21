namespace AFBack.Controllers;
using Microsoft.AspNetCore.Mvc;
using AFBack.DTOs;
using AFBack.Models;
using BCrypt.Net;
using System.Threading.Tasks;
using AFBack.Data;
using Microsoft.EntityFrameworkCore;
using CountryData.Standard;
using AFBack.Services;

// Forteller backend at alle API-endepunktene i denne klassen skal ha api/user som base-url
[Route("api/user")]
// Gjør klassen til en API-kontroller, automatisk sjekk at det er riktig input, automatisk konvertering JSON-requests til objekter.
[ApiController]
public class UserController : ControllerBase
{
    // Egenskapen for å koble oss til databasen, settes kun engang i konstruktøren
    private readonly ApplicationDbContext _context;
    
    // CountryData for å hente alle land og providenser til en liste.
    private readonly CountryHelper _countryHelper;
    // Loggeren
    private readonly ILogger<UserController> _logger;
    
    // Lager token og sjekker at passord og epost er riktig.
    private readonly AuthService _authService;

    // Konstruktøren. Lagrer context som en variabel og countryHelperen som en variabel. Kommer fra CountryData.Standard. Loggeren og authService.
    public UserController(ApplicationDbContext context, ILogger<UserController> logger, AuthService authService)
    {
        _context = context;
        _countryHelper = new CountryHelper();
        _logger = logger;
        _authService = authService;
    }
    
   
    
    // // Her bruker vi LINQ til å finne landkoden til valgt land ved hjelp av Where og Select. Vi bruker denne feks til GetRegionsByCountry til å sende
    // regionene til frontend etter bruker har valgt land.
    private string? GetCountryCodeByName(string countryName)
    {
        return _countryHelper.GetCountryData().Where(country => country.CountryName.Equals(countryName, StringComparison.OrdinalIgnoreCase)).Select(country => country.CountryShortCode).FirstOrDefault();
    }
    
   
    
    // Endepunkt som blir sendt fra frontend basert på valgt land og sender tilbake en liste med alle regionene til valgt land
    [HttpGet("regions/{countryName}")]
    public IActionResult GetRegionsByCountry(string countryName)
    {
        
        var countryCode = GetCountryCodeByName(countryName);
        // Hvis stringen er tom eller null, hvis vi ikke finner et navnm så gir vi feilbeskjed
        if (string.IsNullOrEmpty(countryCode))
            return BadRequest(new { message = "Invalid country name." });
        
        //Hvis ikke så lagrer vi alle regionene i en liste
        var regions = _countryHelper.GetRegionByCountryCode(countryCode);
        
        // Hvis det ikke er noen regioner i listen så får vi en feilmelding på det.
        if (regions == null || !regions.Any())
        {
            _logger.LogInformation("Ingen regioner funnet for {CountryName}. Returnerer tom liste.", countryName);
            return Ok(new List<string>());
        }
        
        // Returner listen med navnene til regionene
        return Ok(regions.Select(region => region.Name).ToList());

    }
    
    
    // Brukes til å fortelle at denne metoden skal håndtere POST-requests fra url med api/user/register
    [HttpPost("register")]
    // Async kjører asynkront, slik at den ikke blokkerer hovedtråden. Dette er viktig når vi jobber med databaser, da det kan ta tid å hente og lagre data.
    // Task betyr at metoden er asynkron og vil returnere en verdi i fremtiden. IActionResult er typen returverdi, som betyr at vi returnerer en HTTP-respons.
    // FromBody betyr at vi skal hente data fra HTTP-requesten sin body, som da er JSON-formate.
    // UserRegisterDTO er klassen vi har laget som bekrefter igjen at all dataen er riktig og oppretter et objekt.
    public async Task<IActionResult> RegisterUser([FromBody] UserRegisterDTO userDto)
    {
        _logger.LogInformation("Registering user with data: {@UserDto}", userDto);
        // Denne sjekker at hvis vi prøver å registere en bruker, men den er i feil format eller ugyldig data, så får vi en feilmelding eller så hadde programmet kræsjet.
        if (!ModelState.IsValid)
        {   
            // Henter ut alle errorene og lagrer det til en liste
            // var errors = ModelState.Values.SelectMany(values => values.Errors).Select(error => error.ErrorMessage)
            //     .ToList();

            var errors = ModelState.ToDictionary(kvp => kvp.Key,
                kvp => kvp.Value.Errors.Select(error => error.ErrorMessage).ToList());

            _logger.LogWarning("Validation failed for user registration. Errors: {@Errors}", errors);
            return BadRequest(new {message = $"Validation failed. Check errors.", errors});
        }
        
        //
        using (var transaction = await _context.Database.BeginTransactionAsync())
        {
               
            try
            {   
                // Fjerner ekstra mellomrom, eller så kan vi få duplikate eposter pga mellomrommet
                userDto.Email = userDto.Email.Trim();
                // Sjekk for at datoen vedkommene er født ikke er en dato som ikke finnes enda.
                if (userDto.DateOfBirth > DateTime.UtcNow)
                {
                    return BadRequest(new { message = "Date of birth cannot be in the future." });
                }
                
                // Krypterer passordet med HashPassword. Umulig å konvertere det krypterte passordet tilbake, men hvis vi gir riktig passord så er det krypterte passordet likt.
                string hashedPassword = BCrypt.HashPassword(userDto.Password);
                
                //Oppretter en ny bruker med dataen vi har fått fra JSON-filen
                var user = new User
                {
                    FirstName = userDto.FirstName,
                    MiddleName = userDto.MiddleName,
                    LastName = userDto.LastName,
                    Email = userDto.Email,
                    PasswordHash = hashedPassword,
                    Phone = userDto.Phone,
                    // Sirker at DateOfBirth tolkes og lagres som UTC da Postgres krever det. SpecifyKind tolker verdien riktig for UTC.
                    DateOfBirth = DateTime.SpecifyKind(userDto.DateOfBirth, DateTimeKind.Utc),
                    CreatedAt = DateTime.UtcNow,
                    Country = userDto.Country,
                    Region = userDto.Region,
                    PostalCode = userDto.PostalCode
                };

                
                // Her gjør vi brukeren klar til å legges til i databasen, context er databasen og Users har vi definert i ApplicationDbContext. 
                await _context.Users.AddAsync(user);
                // Her lagrer vi brukeren til databasen.
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();
                
                
                // Ok er en metode som returnerer en HTTP 200 Ok-respons til klienten. Brukes når alt har gått bra.
                return Ok(new
                {
                    message = "User registered successfully!",
                    userId = user.Id,
                    email = user.Email
                });
            }
            catch (DbUpdateException e)
            {
                await transaction.RollbackAsync();

                if (e.InnerException?.Message.Contains("duplicate key value") == true)
                {
                    _logger.LogWarning("Duplicate email detected: {Email}", userDto.Email);
                    return BadRequest(new { message = "Email is already registered." });
                }

                _logger.LogError("Error saving user: {Error}", e.Message);
                return StatusCode(500, new { message = "An error occured while saving the user." });
            }
            catch (Exception e)
            {
                _logger.LogError("Database connection failed: {Error}", e.Message);
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = "Database connection error. Please try again later." });
            }
        }
    }
    
    // Her sjekker vi at brukeren 
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] UserLoginDTO userLoginDto)
    {
        if (!ModelState.IsValid)
            return BadRequest(new { message = "Invalid login requests." });

        var token = await _authService.LoginAsync(userLoginDto.Email, userLoginDto.Password);

        if (token == null)
        {
            _logger.LogWarning("Failed login attempt for email: {Email}", userLoginDto.Email);
            return Unauthorized(new { message = "Invalid email or password." });
        }

        return Ok(new { token });


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
            bool emailExists = await _context.Users.AnyAsync(user => EF.Functions.Like(user.Email, email));

            return Ok(new { exists = emailExists });
        }
        catch (Exception e)
        {
            _logger.LogError("Error while checking email: {Error}", e.Message);
            return StatusCode(500, new { message = "Database error. Try again later." });
        }
    }
    
    
    
    
}