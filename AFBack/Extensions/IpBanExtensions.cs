using Microsoft.AspNetCore.Mvc;
using AFBack.Services;

namespace AFBack.Extensions;

public static class IpBanExtensions
{
    /// <summary>
    /// Henter klientens IP-adresse fra HttpContext
    /// </summary>
    public static string? GetClientIpAddress(this HttpContext httpContext)
    {
        // Prøv RemoteIpAddress først
        string? clientIp = httpContext.Connection.RemoteIpAddress?.ToString();
        
        // Håndter IPv6 loopback
        if (clientIp == "::1")
        {
            clientIp = "127.0.0.1";
        }
        
        // Sjekk X-Forwarded-For header (for reverse proxies/load balancers)
        if (string.IsNullOrEmpty(clientIp) || clientIp == "127.0.0.1")
        {
            var forwardedFor = httpContext.Request.Headers["X-Forwarded-For"].FirstOrDefault();
            if (!string.IsNullOrEmpty(forwardedFor))
            {
                clientIp = forwardedFor.Split(',')[0].Trim();
            }
        }
        
        // Sjekk X-Real-IP header
        if (string.IsNullOrEmpty(clientIp) || clientIp == "127.0.0.1")
        {
            clientIp = httpContext.Request.Headers["X-Real-IP"].FirstOrDefault() ?? clientIp;
        }
        
        // Sjekk CF-Connecting-IP header (Cloudflare)
        if (string.IsNullOrEmpty(clientIp) || clientIp == "127.0.0.1")
        {
            clientIp = httpContext.Request.Headers["CF-Connecting-IP"].FirstOrDefault() ?? clientIp;
        }
        
        return clientIp;
    }

    /// <summary>
    /// Henter User-Agent fra request headers
    /// </summary>
    public static string GetUserAgent(this HttpContext httpContext)
    {
        return httpContext.Request.Headers["User-Agent"].FirstOrDefault() ?? "Unknown";
    }

    /// <summary>
    /// Sjekker om IP er bannet og returnerer Forbidden response hvis den er det
    /// </summary>
    public static async Task<IActionResult?> CheckIpBanAsync(
        this ControllerBase controller, 
        IpBanService ipBanService, 
        ILogger logger)
    {
        var clientIp = controller.HttpContext.GetClientIpAddress();
        
        if (await ipBanService.IsIpBannedAsync(clientIp))
        {
            logger.LogWarning("Request from banned IP: {IP} to {Endpoint}", 
                clientIp, controller.HttpContext.Request.Path);
            
            return controller.StatusCode(403, new { message = "Access denied." });
        }
        
        return null; // IP er ikke bannet
    }

    /// <summary>
    /// Rapporterer mistenkelig aktivitet med automatisk IP og metadata
    /// </summary>
    public static async Task ReportSuspiciousActivityAsync(
        this ControllerBase controller,
        IpBanService ipBanService,
        string activityType,
        string reason,
        ILogger? logger = null)
    {
        var httpContext = controller.HttpContext;
        var clientIp = httpContext.GetClientIpAddress();
        var userAgent = httpContext.GetUserAgent();
        var endpoint = httpContext.Request.Path.ToString();

        await ipBanService.ReportSuspiciousActivityAsync(
            clientIp, 
            activityType, 
            reason, 
            userAgent, 
            endpoint);

        logger?.LogWarning("Suspicious activity reported from IP {IP}: {ActivityType} - {Reason}", 
            clientIp, activityType, reason);
    }

    /// <summary>
    /// Komplett IP-ban sjekk og logging for auth endpoints
    /// </summary>
    public static async Task<AuthIpCheckResult> CheckAuthEndpointAsync(
        this ControllerBase controller,
        IpBanService ipBanService,
        ILogger logger,
        string endpointName,
        string? userIdentifier = null)
    {
        var clientIp = controller.HttpContext.GetClientIpAddress();
        
        // Sjekk om IP er bannet
        if (await ipBanService.IsIpBannedAsync(clientIp))
        {
            logger.LogWarning("{Endpoint} attempt from banned IP: {IP}{UserInfo}", 
                endpointName, clientIp, 
                !string.IsNullOrEmpty(userIdentifier) ? $" (User: {userIdentifier})" : "");
            
            var forbiddenResult = controller.StatusCode(403, new { message = "Access denied." });
            return new AuthIpCheckResult { IsBanned = true, ActionResult = forbiddenResult };
        }

        logger.LogInformation("{Endpoint} attempt from IP: {IP}{UserInfo}", 
            endpointName, clientIp,
            !string.IsNullOrEmpty(userIdentifier) ? $" (User: {userIdentifier})" : "");

        return new AuthIpCheckResult { IsBanned = false, ClientIp = clientIp };
    }
    
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
        // Sjekk for vanlige mistenkelige mønstre
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