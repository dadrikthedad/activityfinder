using System.Security.Cryptography;
using AFBack.DTOs.Auth;

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
    public async Task<LoginResponseDTO?> LoginAsync(string email, string password)
    {
        var user = await _context.Users.AsNoTracking()
            .SingleOrDefaultAsync(user => user.Email.ToLower() == email.ToLower());

        if (user == null || !user.VerifyPassword(password))
        {
            _logger.LogWarning("Failed login attempt for email: {Email}", email);
            return null;
        }

        if (!user.EmailConfirmed)
        {
            _logger.LogWarning("Login attempt with unverified email: {Email}", email);
            return null; // Eller kast en spesiell exception
        }

        // Generer tokens
        var accessToken = GenerateJwtToken(user);
        var refreshToken = GenerateRefreshToken();
        var refreshTokenExpiry = DateTime.UtcNow.AddDays(30); // 30 dager for refresh token

        // Lagre refresh token i database
        await SaveRefreshTokenAsync(user.Id, refreshToken, refreshTokenExpiry);

        return new LoginResponseDTO
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            AccessTokenExpires = DateTime.UtcNow.AddMinutes(15), // Kort levetid for access token
            RefreshTokenExpires = refreshTokenExpiry
        };
    }
    
    // Ny metode for å fornye access token
    public async Task<LoginResponseDTO?> RefreshTokenAsync(string refreshToken)
    {
        var storedToken = await _context.RefreshTokens
            .Include(rt => rt.User)
            .SingleOrDefaultAsync(rt => rt.Token == refreshToken && !rt.IsRevoked);

        if (storedToken == null || storedToken.ExpiryDate <= DateTime.UtcNow)
        {
            _logger.LogWarning("Invalid or expired refresh token attempted");
            return null;
        }
        

        // Generer ny access token
        var newAccessToken = GenerateJwtToken(storedToken.User);
        
        // Valgfritt: Generer ny refresh token (rotation)
        var newRefreshToken = GenerateRefreshToken();
        var newRefreshTokenExpiry = DateTime.UtcNow.AddDays(30);

        // Oppdater refresh token i database
        storedToken.IsRevoked = true; // Gjør den gamle ugyldig
        await SaveRefreshTokenAsync(storedToken.UserId, newRefreshToken, newRefreshTokenExpiry);
        await _context.SaveChangesAsync();

        return new LoginResponseDTO
        {
            AccessToken = newAccessToken,
            RefreshToken = newRefreshToken,
            AccessTokenExpires = DateTime.UtcNow.AddMinutes(15),
            RefreshTokenExpires = newRefreshTokenExpiry
        };
    }
    
    // Logout - gjør refresh token ugyldig
    public async Task<bool> LogoutAsync(string refreshToken)
    {
        var storedToken = await _context.RefreshTokens
            .SingleOrDefaultAsync(rt => rt.Token == refreshToken);

        if (storedToken != null)
        {
            storedToken.IsRevoked = true;
            await _context.SaveChangesAsync();
            return true;
        }
        return false;
    }
    
    // Oppdatert JWT-generering med kortere levetid
    private string GenerateJwtToken(Models.User user)
    {
        var jwtKey = Environment.GetEnvironmentVariable("JWT_SECRET_KEY") 
                     ?? throw new Exception("JWT Key is missing in environment variables.");
        var jwtIssuer = Environment.GetEnvironmentVariable("JWT_ISSUER") ??
                        throw new Exception("JWT_ISSUER is missing.");
        var jwtAudience = Environment.GetEnvironmentVariable("JWT_AUDIENCE") ??
                          throw new Exception("JWT_AUDIENCE is missing.");

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Name, user.FullName),
            new Claim(ClaimTypes.Role, user.Role)
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha512);
        
        // Kortere levetid for access token
        var token = new JwtSecurityToken(
            issuer: jwtIssuer, 
            audience: jwtAudience,
            claims: claims, 
            expires: DateTime.UtcNow.AddMinutes(15), // 15 minutter i stedet for 7 dager
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
    
    // Generer sikker refresh token
    private string GenerateRefreshToken()
    {
        var randomBytes = new byte[64];
        using (var rng = RandomNumberGenerator.Create())
        {
            rng.GetBytes(randomBytes);
        }
        return Convert.ToBase64String(randomBytes);
    }

    // Lagre refresh token i database
    private async Task SaveRefreshTokenAsync(int userId, string token, DateTime expiry)
    {
        // Hent aktive tokens for brukeren, sortert etter alder
        var activeTokens = await _context.RefreshTokens
            .Where(rt => rt.UserId == userId && !rt.IsRevoked && rt.ExpiryDate > DateTime.UtcNow)
            .OrderBy(rt => rt.CreatedDate)
            .ToListAsync();

        // Hvis vi har 5 eller flere aktive tokens, annuller de eldste
        if (activeTokens.Count >= 5)
        {
            var tokensToRevoke = activeTokens.Take(activeTokens.Count - 4).ToList();
            foreach (var tokenToRevoke in tokensToRevoke)
            {
                tokenToRevoke.IsRevoked = true;
                _logger.LogInformation("Revoked old refresh token for user {UserId} due to limit", userId);
            }
        }

        // Legg til ny token
        var refreshToken = new RefreshToken
        {
            Token = token,
            UserId = userId,
            ExpiryDate = expiry,
            IsRevoked = false,
            CreatedDate = DateTime.UtcNow
        };

        _context.RefreshTokens.Add(refreshToken);
        await _context.SaveChangesAsync();
    }
    
    public async Task CleanupExpiredTokensAsync()
    {
        var expiredTokens = await _context.RefreshTokens
            .Where(rt => rt.ExpiryDate <= DateTime.UtcNow || rt.IsRevoked)
            .ToListAsync();
    
        _context.RefreshTokens.RemoveRange(expiredTokens);
        await _context.SaveChangesAsync();
    }

}