using AFBack.DTOs.Security;
using Microsoft.AspNetCore.Mvc;
using AFBack.Services;
using AFBack.Utils;

namespace AFBack.Extensions;

public static class IpBanExtensions
{
    /// <summary>
    /// Henter klientens IP-adresse fra HttpContext (wrapper for IpUtils.GetClientIp)
    /// </summary>
    public static string? GetClientIpAddress(this HttpContext httpContext)
    {
        return IpUtils.GetClientIp(httpContext);
    }

    /// <summary>
    /// Henter User-Agent fra request headers
    /// </summary>
    public static string GetUserAgent(this HttpContext httpContext)
    {
        return httpContext.Request.Headers["User-Agent"].FirstOrDefault() ?? "Unknown";
    }

    /// <summary>
    /// Henter device ID fra mobile app headers
    /// </summary>
    public static string? GetDeviceId(this HttpContext httpContext)
    {
        return httpContext.Request.Headers["X-Device-ID"].FirstOrDefault();
    }

    /// <summary>
    /// Sjekker om det er en mobile app request
    /// </summary>
    public static bool IsMobileAppRequest(this HttpContext httpContext)
    {
        return IpUtils.IsMobileAppRequest(httpContext);
    }

    /// <summary>
    /// OPPDATERT: Sjekker om IP eller device er bannet og returnerer Forbidden response hvis den er det
    /// </summary>
    public static async Task<IActionResult?> CheckIpOrDeviceBanAsync(
        this ControllerBase controller, 
        IpBanService ipBanService, 
        ILogger logger)
    {
        var httpContext = controller.HttpContext;
        var clientIp = httpContext.GetClientIpAddress();
        var deviceId = httpContext.GetDeviceId();
        var isMobile = httpContext.IsMobileAppRequest();
        
        if (await ipBanService.IsIpOrDeviceBannedAsync(clientIp, deviceId))
        {
            var deviceInfo = !string.IsNullOrEmpty(deviceId) ? $" Device: {deviceId[..8]}..." : "";
            logger.LogWarning("Request from banned {Type}{DeviceInfo} IP: {IP} to {Endpoint}", 
                isMobile ? "mobile device" : "IP", deviceInfo, clientIp, httpContext.Request.Path);
            
            return controller.StatusCode(403, new { message = "Access denied." });
        }
        
        return null; // Ikke bannet
    }

    /// <summary>
    /// Legacy method - redirects to new method
    /// </summary>
    [Obsolete("Use CheckIpOrDeviceBanAsync instead")]
    public static async Task<IActionResult?> CheckIpBanAsync(
        this ControllerBase controller, 
        IpBanService ipBanService, 
        ILogger logger)
    {
        return await controller.CheckIpOrDeviceBanAsync(ipBanService, logger);
    }

    /// <summary>
    /// FORBEDRET: Rapporterer mistenkelig aktivitet med automatisk IP, device og metadata
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
        var deviceId = httpContext.GetDeviceId();
        var userAgent = httpContext.GetUserAgent();
        var endpoint = httpContext.Request.Path.ToString();
        var isMobile = httpContext.IsMobileAppRequest();

        await ipBanService.ReportSuspiciousActivityAsync(
            clientIp, 
            activityType, 
            reason, 
            userAgent, 
            endpoint,
            deviceId); // NYTT: Device ID parameter

        var deviceInfo = !string.IsNullOrEmpty(deviceId) ? $" Device: {deviceId[..8]}..." : "";
        logger?.LogWarning("Suspicious activity reported from {Type}{DeviceInfo} IP {IP}: {ActivityType} - {Reason}", 
            isMobile ? "mobile" : "web", deviceInfo, clientIp, activityType, reason);
    }

    /// <summary>
    /// FORBEDRET: Komplett ban-sjekk og logging for auth endpoints med device support
    /// </summary>
    public static async Task<AuthIpCheckResult> CheckAuthEndpointAsync(
        this ControllerBase controller,
        IpBanService ipBanService,
        ILogger logger,
        string endpointName,
        string? userIdentifier = null)
    {
        var httpContext = controller.HttpContext;
        var clientIp = httpContext.GetClientIpAddress();
        var deviceId = httpContext.GetDeviceId();
        var isMobile = httpContext.IsMobileAppRequest();
        var isSharedNetwork = IpUtils.IsFromSharedNetwork(clientIp);
        
        // OPPDATERT: Sjekk både IP og device bans
        if (await ipBanService.IsIpOrDeviceBannedAsync(clientIp, deviceId))
        {
            var deviceInfo = !string.IsNullOrEmpty(deviceId) ? $" Device: {deviceId[..8]}..." : "";
            var networkInfo = isSharedNetwork ? " (shared network)" : "";
            
            logger.LogWarning("{Endpoint} attempt from banned {Type}{DeviceInfo} IP: {IP}{NetworkInfo}{UserInfo}", 
                endpointName, isMobile ? "mobile device" : "IP", deviceInfo, clientIp, networkInfo,
                !string.IsNullOrEmpty(userIdentifier) ? $" (User: {userIdentifier})" : "");
            
            var forbiddenResult = controller.StatusCode(403, new { message = "Access denied." });
            return new AuthIpCheckResult { IsBanned = true, ActionResult = forbiddenResult };
        }

        // FORBEDRET: Mer detaljert logging
        var deviceInfoLog = !string.IsNullOrEmpty(deviceId) ? $" Device: {deviceId[..8]}..." : "";
        var networkInfoLog = isSharedNetwork ? " (shared network)" : "";
        
        logger.LogInformation("{Endpoint} attempt from {Type}{DeviceInfo} IP: {IP}{NetworkInfo}{UserInfo}", 
            endpointName, isMobile ? "mobile" : "web", deviceInfoLog, clientIp, networkInfoLog,
            !string.IsNullOrEmpty(userIdentifier) ? $" (User: {userIdentifier})" : "");

        return new AuthIpCheckResult 
        { 
            IsBanned = false, 
            ClientIp = clientIp,
            DeviceId = deviceId,
            IsMobileApp = isMobile,
            IsSharedNetwork = isSharedNetwork
        };
    }
    
    /// <summary>
    /// NYTT: Spesialisert auth failure rapportering
    /// </summary>
    public static async Task ReportAuthFailureAsync(
        this ControllerBase controller,
        IpBanService ipBanService,
        string failureType,
        string? userIdentifier = null,
        ILogger? logger = null)
    {
        var httpContext = controller.HttpContext;
        var reason = !string.IsNullOrEmpty(userIdentifier) 
            ? $"{failureType} for user: {userIdentifier}"
            : failureType;
            
        await controller.ReportSuspiciousActivityAsync(
            ipBanService, 
            "LOGIN_ATTEMPT", 
            reason, 
            logger);
    }

    /// <summary>
    /// NYTT: Quick check for rate limiting context
    /// </summary>
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