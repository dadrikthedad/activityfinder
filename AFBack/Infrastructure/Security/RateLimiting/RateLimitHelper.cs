using AFBack.Infrastructure.Extensions;
using AFBack.Infrastructure.Security.Utils;

namespace AFBack.Infrastructure.Security.RateLimiting;

public static class RateLimitHelper
{
    /// <summary>
    /// Genererer partition key for rate limiting.
    /// Strategi:
    /// - Autentisert bruker → bruker-ID (IP irrelevant — fungerer på mobilnett, VPN, alt)
    /// - Uautentisert mobil → IP + device fingerprint
    /// - Uautentisert web  → IP + browser fingerprint
    /// </summary>
    public static string GetPartitionKey(HttpContext context)
    {
        // Autentisert: bruker-ID er alltid best. Returner user:3218398193
        var userId = context.User.GetUserIdOrDefault();
        if (userId != null)
            return $"user:{userId}";

        // === Uautentisert: IP + fingerprint ===
        // Henter Ip
        var clientIp = IpUtils.GetClientIp(context) ?? "unknown";
        
        // Hvis det er en request mobilappen
        if (IpUtils.IsMobileAppRequest(context))
        {
            // Henter devicefingerprint og returner feks: anon-mobile:192.168.1.45:aB3xK9mQ2nLp
            var deviceFingerprint = FingerprintUtils.GetMobileDeviceFingerprint(context);
            return $"anon-mobile:{clientIp}:{deviceFingerprint}";
        }
        
        // Henter webfingerprint og returner feks: anon-web:192.168.1.45:Xk2mNq8pR1vT
        var webFingerprint = FingerprintUtils.GetWebFingerprint(context);
        return $"anon-web:{clientIp}:{webFingerprint}";
    }
}
