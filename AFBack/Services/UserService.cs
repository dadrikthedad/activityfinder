using AFBack.Data;
using AFBack.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Services;

public class UserService
{
    private readonly ApplicationDbContext _context;

    public UserService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<string> CreateVerificationTokenAsync(string email)
    {
        var token = Guid.NewGuid().ToString();

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user != null)
        {
            user.EmailConfirmationToken = token; // Matcher ditt field navn
            await _context.SaveChangesAsync();
        }

        return token;
    }

    public async Task<bool> VerifyEmailTokenAsync(string token)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => 
            u.EmailConfirmationToken == token); // Fjernet expiry check
        
        if (user != null)
        {
            user.EmailConfirmed = true; // Matcher ditt field navn
            user.EmailConfirmationToken = null; // Fjern token etter bruk
            await _context.SaveChangesAsync();
            return true;
        }

        return false;
    }

    public async Task<User?> GetUserByTokenAsync(string token)
    {
        return await _context.Users.FirstOrDefaultAsync(u => 
            u.EmailConfirmationToken == token);
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
}