using System.Net;

namespace AFBack.Infrastructure.Security.Utils;

public static class IpUtils
{
    /// <summary>
    /// Henter klientens ekte IP-adresse ved å sjekke proxy-headers først (X-Forwarded-For, X-Real-IP),
    /// deretter faller tilbake til TCP-forbindelsens RemoteIpAddress.
    /// Alle adresser normaliseres via NormalizeIp for konsistent format.
    /// </summary>
    /// <param name="context">HttpForespørselen</param>
    /// <returns>String eller null</returns>
    public static string? GetClientIp(HttpContext context)
    {
        // Sjekk X-Forwarded-For først - headeren fra Proxy
        var forwardedFor = context.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrEmpty(forwardedFor))
        {
            // Tar første IPen som hører til proxy
            var firstIp = forwardedFor.Split(',')[0].Trim();
            
            // Normaliserer den til ivp4
            var normalized = NormalizeIpAdress(firstIp);
            if (normalized != null) 
                return normalized;
        }

        // Sjekk X-Real-IP - Nginx bruker denne feks
        var realIp = context.Request.Headers["X-Real-IP"].FirstOrDefault();
        if (!string.IsNullOrEmpty(realIp))
        {
            var normalized = NormalizeIpAdress(realIp);
            if (normalized != null) 
                return normalized;
        }

        // Fallback til RemoteIpAddress - IPen til internettforbindelsen mellom forespørsel og backend
        return NormalizeIpAdress(context.Connection.RemoteIpAddress?.ToString());
    }
    
    /// <summary>
    /// Validerer at det er en gyldig IP, Konverterer IPv4-mapped IPv6-adresser (::ffff:x.x.x.x) til ren IPv4
    /// og returner IP-en med ToString().
    /// Returnerer null hvis adressen er tom eller ugyldig.
    /// </summary>
    /// <param name="ipAddress">IP-adressen som skal normaliseres</param>
    /// <returns>Normalisert IP-adresse, eller null hvis ugyldig/tom</returns>
    public static string? NormalizeIpAdress(string? ipAddress)
    {
        // Sjekker at IP-adressen  ikke er tom
        if (string.IsNullOrEmpty(ipAddress))
            return null;
        
        // Sjekker at det er en IP-adresse
        if (!IPAddress.TryParse(ipAddress, out var ip)) 
            return null;
        
        // Hvis det er en IPv4 mapped til IPv6, gjør den om til en IPv4
        if (ip.IsIPv4MappedToIPv6)
            ip = ip.MapToIPv4();
        
        // Returner ipAdressen
        return ip.ToString();
    }

    /// <summary>
    /// Sjekker om request kommer fra mobile app basert på custom headers.
    /// Frontend setter dette i Appen, men ikke i Web
    /// </summary>
    /// <param name="context">HttpForespørselen</param>
    /// <returns>True hvis det er en verifisert app request, false hvis ikke</returns>
    public static bool IsMobileAppRequest(HttpContext context)
    {
        // Sjekker verdier i headeren
        var hasDeviceId = !string.IsNullOrEmpty(context.Request.Headers["X-Device-ID"]);
        var hasAppVersion = !string.IsNullOrEmpty(context.Request.Headers["X-App-Version"]);
        var hasPlatform = !string.IsNullOrEmpty(context.Request.Headers["X-Device-Platform"]);
        
        return hasDeviceId && hasAppVersion && hasPlatform;
    }
    

    
    
    
}
