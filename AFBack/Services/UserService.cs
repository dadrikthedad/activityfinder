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
        user.VerificationInfo.EmailConfirmationTokenExpires = DateTime.UtcNow.AddHours(1);
        
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
                (v.EmailConfirmationToken == tokenOrCode || 
                 v.EmailConfirmationCode == tokenOrCode) &&
                v.EmailConfirmationTokenExpires > DateTime.UtcNow);
    
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
    

    public async Task<(string token, string code)?> CreatePasswordResetTokenAsync(string email)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var user = await _context.Users
            .Include(u => u.VerificationInfo)
            .FirstOrDefaultAsync(u => u.Email == normalizedEmail);
            
        if (user == null)
        {
            return null;
        }

        // Opprett VerificationInfo hvis den ikke finnes
        if (user.VerificationInfo == null)
        {
            user.VerificationInfo = new VerificationInfo
            {
                User = user
            };
        }

        // Generer URL-vennlig token for web-link
        var tokenBytes = RandomNumberGenerator.GetBytes(32);
        var token = Convert.ToBase64String(tokenBytes)
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');

        // Generer 6-sifret kode for app input
        var random = new Random();
        var code = random.Next(100000, 999999).ToString();
        
        var expiry = DateTime.UtcNow.AddHours(1);
        
        user.VerificationInfo.PasswordResetToken = token;
        user.VerificationInfo.PasswordResetCode = code;
        user.VerificationInfo.PasswordResetTokenExpires = expiry; // Samme utløpstid for begge

        await _context.SaveChangesAsync();
        return (token, code);
    }

    public async Task<bool> ValidatePasswordResetTokenAsync(string tokenOrCode)
    {
        var verificationInfo = await _context.VerificationInfos
            .FirstOrDefaultAsync(v => 
                (v.PasswordResetToken == tokenOrCode || v.PasswordResetCode == tokenOrCode) && 
                v.PasswordResetTokenExpires > DateTime.UtcNow);

        return verificationInfo != null;
    }

    public async Task<bool> ResetPasswordAsync(string tokenOrCode, string newPassword)
    {
        var verificationInfo = await _context.VerificationInfos
            .Include(v => v.User)
            .FirstOrDefaultAsync(v => 
                (v.PasswordResetToken == tokenOrCode || v.PasswordResetCode == tokenOrCode) && 
                v.PasswordResetTokenExpires > DateTime.UtcNow);

        if (verificationInfo?.User == null)
            return false;

        // Hash det nye passordet
        verificationInfo.User.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);

        // Fjern begge tokens etter bruk
        verificationInfo.PasswordResetToken = null;
        verificationInfo.PasswordResetCode = null;
        verificationInfo.PasswordResetTokenExpires = null;

        await _context.SaveChangesAsync();
        return true;
    }
}