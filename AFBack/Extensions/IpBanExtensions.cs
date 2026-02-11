using AFBack.DTOs.Security;
using AFBack.Infrastructure.Security.Services;
using AFBack.Infrastructure.Security.Utils;
using Microsoft.AspNetCore.Mvc;
using AFBack.Services;

namespace AFBack.Extensions;

public static class IpBanExtensions
{
    // === CONTEXT HELPERS ===
    

    
    

    // === EMAIL VALIDATION ===
    
    public static bool IsValidEmail(string email)
    {
        try
        {
            var addr = new System.Net.Mail.MailAddress(email);
            return addr.Address == email && email.Contains('@') && email.Length <= 254;
        }
        catch
        {
            return false;
        }
    }
    
    public static bool IsSuspiciousEmailPattern(string email)
    {
        var suspiciousPatterns = new[]
        {
            "test@", "admin@", "root@", "postmaster@",
            "noreply@", "no-reply@", "@test", "@example"
        };
        
        return suspiciousPatterns.Any(pattern => 
                   email.Contains(pattern, StringComparison.OrdinalIgnoreCase)) ||
               email.Length > 254 || 
               email.Split('@').Length != 2;
    }
}
