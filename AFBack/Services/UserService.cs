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

    public async Task<(string? longToken, string? shortCode)> CreateVerificationTokenAsync(string email)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var user = await _context.Users
            .Include(u => u.VerificationInfo)
            .FirstOrDefaultAsync(u => u.Email == normalizedEmail);
            
        if (user == null)
            return (null, null);

        var longToken = Guid.NewGuid().ToString(); // For web deep links
        var shortCode = RandomNumberGenerator.GetInt32(100000, 1000000).ToString(); // For manuell input

        // Opprett VerificationInfo hvis den ikke finnes
        if (user.VerificationInfo == null)
        {
            user.VerificationInfo = new VerificationInfo
            {
                User = user
            };
        }

        user.VerificationInfo.EmailConfirmationToken = longToken;
        user.VerificationInfo.EmailConfirmationCode = shortCode;
        // FJERNET LastVerificationEmailSent - håndteres av egen metode
        
        await _context.SaveChangesAsync();

        return (longToken, shortCode);
    }

    public async Task MarkVerificationEmailSentAsync(string email)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var user = await _context.Users
            .Include(u => u.VerificationInfo)
            .FirstOrDefaultAsync(u => u.Email == normalizedEmail);
            
        if (user?.VerificationInfo != null)
        {
            user.VerificationInfo.LastVerificationEmailSent = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }
    }

    public async Task<bool> VerifyEmailTokenAsync(string tokenOrCode)
    {
        // Spør direkte på VerificationInfos for bedre ytelse
        var verificationInfo = await _context.VerificationInfos
            .Include(v => v.User)
            .FirstOrDefaultAsync(v => 
                v.EmailConfirmationToken == tokenOrCode || 
                v.EmailConfirmationCode == tokenOrCode);
    
        if (verificationInfo?.User != null)
        {
            verificationInfo.User.EmailConfirmed = true;
            verificationInfo.EmailConfirmationToken = null; // Fjern begge etter bruk
            verificationInfo.EmailConfirmationCode = null;
            await _context.SaveChangesAsync();
            return true;
        }

        return false;
    }

    public async Task<User?> GetUserByTokenAsync(string tokenOrCode)
    {
        // Spør direkte på VerificationInfos
        var verificationInfo = await _context.VerificationInfos
            .Include(v => v.User)
            .FirstOrDefaultAsync(v => 
                v.EmailConfirmationToken == tokenOrCode || 
                v.EmailConfirmationCode == tokenOrCode);
        
        return verificationInfo?.User;
    }

    public async Task<bool> MarkEmailAsVerifiedAsync(string email)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail);
        if (user != null)
        {
            user.EmailConfirmed = true; // EmailConfirmed forblir på User
            await _context.SaveChangesAsync();
            return true;
        }
        return false;
    }
    
    public async Task<string?> CreatePasswordResetTokenAsync(string email)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var user = await _context.Users
            .Include(u => u.VerificationInfo)
            .FirstOrDefaultAsync(u => u.Email == normalizedEmail);
            
        if (user == null)
        {
            // Av sikkerhetsgrunner, returner null uten å avsløre om eposten eksisterer
            return null;
        }

        // Generer URL-vennlig token
        var tokenBytes = RandomNumberGenerator.GetBytes(32);
        var token = Convert.ToBase64String(tokenBytes)
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('='); // Base64Url format

        // Opprett VerificationInfo hvis den ikke finnes
        if (user.VerificationInfo == null)
        {
            user.VerificationInfo = new VerificationInfo
            {
                User = user
            };
        }

        user.VerificationInfo.PasswordResetToken = token;
        user.VerificationInfo.PasswordResetTokenExpires = DateTime.UtcNow.AddHours(1); // Utløper etter 1 time
    
        await _context.SaveChangesAsync();
        return token;
    }

    public async Task<bool> ValidatePasswordResetTokenAsync(string token)
    {
        // Spør direkte på VerificationInfos
        var verificationInfo = await _context.VerificationInfos
            .FirstOrDefaultAsync(v => 
                v.PasswordResetToken == token && 
                v.PasswordResetTokenExpires > DateTime.UtcNow);
    
        return verificationInfo != null;
    }

    public async Task<bool> ResetPasswordAsync(string token, string newPassword)
    {
        // Spør direkte på VerificationInfos
        var verificationInfo = await _context.VerificationInfos
            .Include(v => v.User)
            .FirstOrDefaultAsync(v => 
                v.PasswordResetToken == token && 
                v.PasswordResetTokenExpires > DateTime.UtcNow);
    
        if (verificationInfo?.User == null)
            return false;
    
        // Hash det nye passordet
        verificationInfo.User.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
    
        // Fjern reset token etter bruk
        verificationInfo.PasswordResetToken = null;
        verificationInfo.PasswordResetTokenExpires = null;
    
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<User?> GetUserByPasswordResetTokenAsync(string token)
    {
        // Spør direkte på VerificationInfos
        var verificationInfo = await _context.VerificationInfos
            .Include(v => v.User)
            .FirstOrDefaultAsync(v => 
                v.PasswordResetToken == token && 
                v.PasswordResetTokenExpires > DateTime.UtcNow);
        
        return verificationInfo?.User;
    }
}