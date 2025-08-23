using System.Net;

namespace AFBack.Utils;

public static class IpUtils
{
    public static string? NormalizeIp(string? ipAddress)
    {
        if (string.IsNullOrEmpty(ipAddress)) 
            return null;

        if (!IPAddress.TryParse(ipAddress, out var ip))
            return null;

        // Konverter IPv4-mapped IPv6 til ren IPv4
        if (ip.IsIPv4MappedToIPv6)
        {
            ip = ip.MapToIPv4();
        }

        return ip.ToString();
    }

    public static string? GetClientIp(HttpContext context)
    {
        // Sjekk X-Forwarded-For først (proxy/CDN)
        var forwardedFor = context.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrEmpty(forwardedFor))
        {
            // Ta første IP hvis flere (client, proxy1, proxy2...)
            var firstIp = forwardedFor.Split(',')[0].Trim();
            var normalized = NormalizeIp(firstIp);
            if (normalized != null) return normalized;
        }

        // Sjekk X-Real-IP
        var realIp = context.Request.Headers["X-Real-IP"].FirstOrDefault();
        if (!string.IsNullOrEmpty(realIp))
        {
            var normalized = NormalizeIp(realIp);
            if (normalized != null) return normalized;
        }

        // Fallback til RemoteIpAddress
        return NormalizeIp(context.Connection.RemoteIpAddress?.ToString());
    }
}