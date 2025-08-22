using System.Security.Cryptography;
using AFBack.Data;
using AFBack.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Services;

public class UserService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<UserService> _logger;

    public UserService(ApplicationDbContext context, ILogger<UserService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<(string longToken, string shortCode)> CreateVerificationTokenAsync(string email)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user == null)
            return (null, null);

        var longToken = Guid.NewGuid().ToString(); // For web deep links
        var shortCode = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();// For manuell input

        user.EmailConfirmationToken = longToken;
        user.EmailConfirmationCode = shortCode;
        await _context.SaveChangesAsync();

        return (longToken, shortCode);
    }

    public async Task<bool> VerifyEmailTokenAsync(string tokenOrCode)
    {
        // Sjekk både long token og short code
        var user = await _context.Users.FirstOrDefaultAsync(u => 
            u.EmailConfirmationToken == tokenOrCode || 
            u.EmailConfirmationCode == tokenOrCode);
    
        if (user != null)
        {
            user.EmailConfirmed = true;
            user.EmailConfirmationToken = null; // Fjern begge etter bruk
            user.EmailConfirmationCode = null;
            await _context.SaveChangesAsync();
            return true;
        }

        return false;
    }

    public async Task<User?> GetUserByTokenAsync(string tokenOrCode)
    {
        return await _context.Users.FirstOrDefaultAsync(u => 
            u.EmailConfirmationToken == tokenOrCode || 
            u.EmailConfirmationCode == tokenOrCode);
    }

    public async Task<bool> MarkEmailAsVerifiedAsync(string email)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user != null)
        {
            user.EmailConfirmed = true; // Matcher ditt field navn
            await _context.SaveChangesAsync();
            return true;
        }
        return false;
    }
    
    public async Task<string?> CreatePasswordResetTokenAsync(string email)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user == null)
        {
            // Av sikkerhetsgrunner, returner null uten å avsløre om eposten eksisterer
            return null;
        }

        // Generer sikker token
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
    
        user.PasswordResetToken = token;
        user.PasswordResetTokenExpires = DateTime.UtcNow.AddHours(1); // Utløper etter 1 time
    
        await _context.SaveChangesAsync();
        return token;
    }

    public async Task<bool> ValidatePasswordResetTokenAsync(string token)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => 
            u.PasswordResetToken == token && 
            u.PasswordResetTokenExpires > DateTime.UtcNow);
    
        return user != null;
    }

    public async Task<bool> ResetPasswordAsync(string token, string newPassword)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => 
            u.PasswordResetToken == token && 
            u.PasswordResetTokenExpires > DateTime.UtcNow);
    
        if (user == null)
            return false;
    
        // Hash det nye passordet
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
    
        // Fjern reset token etter bruk
        user.PasswordResetToken = null;
        user.PasswordResetTokenExpires = null;
    
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<User?> GetUserByPasswordResetTokenAsync(string token)
    {
        return await _context.Users.FirstOrDefaultAsync(u => 
            u.PasswordResetToken == token && 
            u.PasswordResetTokenExpires > DateTime.UtcNow);
    }
}