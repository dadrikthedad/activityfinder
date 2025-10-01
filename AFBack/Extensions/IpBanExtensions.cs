using AFBack.DTOs.Security;
using AFBack.Interface.Services;
using Microsoft.AspNetCore.Mvc;
using AFBack.Services;
using AFBack.Utils;

namespace AFBack.Extensions;

public static class IpBanExtensions
{
    // === CONTEXT HELPERS ===
    
    public static string? GetClientIpAddress(this HttpContext httpContext)
        => IpUtils.GetClientIp(httpContext);

    public static string GetUserAgent(this HttpContext httpContext)
        => httpContext.Request.Headers["User-Agent"].FirstOrDefault() ?? "Unknown";

    public static string? GetDeviceId(this HttpContext httpContext)
        => httpContext.Request.Headers["X-Device-ID"].FirstOrDefault();

    public static bool IsMobileAppRequest(this HttpContext httpContext)
        => IpUtils.IsMobileAppRequest(httpContext);

    public static RateLimitContext GetRateLimitContext(this HttpContext httpContext)
    {
        var clientIp = IpUtils.GetClientIp(httpContext);
        var deviceId = httpContext.GetDeviceId();
        var isMobile = IpUtils.IsMobileAppRequest(httpContext);
        var isSharedNetwork = IpUtils.IsFromSharedNetwork(clientIp);
        
        return new RateLimitContext
        {
            ClientIp = clientIp,
            DeviceId = deviceId,
            IsMobileApp = isMobile,
            IsSharedNetwork = isSharedNetwork,
            PartitionKey = IpUtils.GetHybridPartitionKey(httpContext)
        };
    }

    // === BUSINESS LOGIC RAPPORTERING ===
    
    /// <summary>
    /// Rapporterer mistenkelig aktivitet fra business logic (duplicate email, validation failures, etc.)
    /// </summary>
    public static async Task ReportSuspiciousActivityAsync(
        this ControllerBase controller,
        IIpBanService ipBanService, // ⬅️ Endre til interface
        string activityType,
        string reason,
        ILogger? logger = null)
    {
        var httpContext = controller.HttpContext;
        var clientIp = httpContext.GetClientIpAddress();
        var deviceId = httpContext.GetDeviceId();
        var userAgent = httpContext.GetUserAgent();
        var endpoint = httpContext.Request.Path.ToString();
        var isMobile = httpContext.IsMobileAppRequest();

        await ipBanService.ReportSuspiciousActivityAsync(
            clientIp, activityType, reason, userAgent, endpoint, deviceId);

        var deviceInfo = !string.IsNullOrEmpty(deviceId) ? $" Device: {deviceId[..8]}..." : "";
        logger?.LogWarning("Suspicious activity reported from {Type}{DeviceInfo} IP {IP}: {ActivityType} - {Reason}", 
            isMobile ? "mobile" : "web", deviceInfo, clientIp, activityType, reason);
    }

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
