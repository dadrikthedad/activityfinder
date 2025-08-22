namespace AFBack.Services;
using Microsoft.EntityFrameworkCore;
using AFBack.Data;
using AFBack.Models;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using System.Security.Claims;
using Microsoft.Extensions.Configuration;
using System.IdentityModel.Tokens.Jwt;
using System.Text;

public class AuthService
{
    // Database connection
    private readonly ApplicationDbContext _context;
    // Gjør at vi kan hente verdier fra appsettings.json og vi henter verdiene for passord og hvem bruker.
    private readonly IConfiguration _config;
    // Loggeren
    private readonly ILogger<AuthService> _logger;

    public AuthService(ApplicationDbContext context, IConfiguration config, ILogger<AuthService> logger)
    {
        _context = context;
        _config = config;
        _logger = logger;
    }   
    
    
    // Task betyr at vi gjør en oppgave og den skal da returnere en string. Oppgaven er at den henter informasjon fra databasen.
    public async Task<string?> LoginAsync(string email, string password)
    {
        //Henter brukeren med eposten som er input fra brukeren. AsNoTracking betyr at vi bare skal lese data og ikke gjøre noen endringer.
        // SingleOrDefualtAsync gir en feil hvis denne asynk operasjonen oppdager flere eposter som ligner.
        var user = await _context.Users.AsNoTracking().SingleOrDefaultAsync(user => user.Email.ToLower() == email.ToLower());
    
        //Feilmelding hvis bruker ikke eksisterer eller passord er feil.
        if (user == null || !user.VerifyPassword(password))
        {
            _logger.LogWarning("Failed login attempt for email: {Email}", email);
            return null;
        }
    
        // *** SJEKK OM EPOST ER VERIFISERT ***
        if (!user.EmailConfirmed)
        {
            _logger.LogWarning("Login attempt with unverified email: {Email}", email);
            return "EMAIL_NOT_VERIFIED"; // Spesiell returverdi for uverifisert epost
        }
    
        // Hvis epost og passord stemmer og epost er verifisert, så lager vi en token
        return GenerateJwtToken(user);
    }
    
    //metoden som lager en JWT-token
    private string GenerateJwtToken(User user)
    {  
        // Disse linjene henter verdiene fra appsettings.json og sjekkker at verdiene finnes. Feks den må sjekke miljøvariabeln for å finne Key
        var jwtKey = Environment.GetEnvironmentVariable("JWT_SECRET_KEY") 
                     ?? throw new Exception("JWT Key is missing in environment variables.");
        // var jwtIssuer = _config["Jwt:Issuer"] ?? throw new Exception("JWT Issuer is missing in configuration.");
        // var jwtAudience = _config["Jwt:Audience"] ?? throw new Exception("JWT audience is missing in configuration.");
        var jwtIssuer = Environment.GetEnvironmentVariable("JWT_ISSUER") ??
                        throw new Exception("JWT_ISSUER is missing.");
        
        var jwtAudience = Environment.GetEnvironmentVariable("JWT_AUDIENCE") ??
                        throw new Exception("JWT_AUDIENCE is missing.");
        
        // En claim er en dictionary med nøkkel og verdier, og vi lagrer da en liste med nøkler og veridene til brukeren som vi skal logge inn med for å legge til i token.
        // Den sjekker rolen og at brukeren er den den utgir seg for. Da slipper vi og sjekke databasen for hver forespørsel.
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Name, user.FullName),
            new Claim(ClaimTypes.Role, user.Role)
        };
        
        
        // Krypterer da den hemmelig miljøvariabelen til en hemmelig key som vi bruker da til tokenen.
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        
        // Dette sikrer at ingen kan forfalske tokenet uten å ha riktig nøkkkel. HmacSha512 er algoritmen vi singerer tokenen med.
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha512);
        // Her slår vi sammen Token-strengen med issueren og audiencen vi har lagret i appesettings.json og lagrer informasjonen om brukeren med claims deretter antall dager før brukeren trenger å logge inn igjen.
        // Til slutt legger vi til signeringen.
        var token = new JwtSecurityToken(issuer: jwtIssuer, audience: jwtAudience,
            claims: claims, expires: DateTime.UtcNow.AddDays(7), signingCredentials: creds);
        
        // returnerer JwtSecurityToken objektet til en string slik at vi kan sende det til frontenden.
        return new JwtSecurityTokenHandler().WriteToken(token);

    }


}