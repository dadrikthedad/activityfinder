using System.Net;
using System.Security.Cryptography;
using System.Text;

namespace AFBack.Utils;

public static class IpUtils
{
    // Kjente shared network ranges (mobile carriers etc.)
    private static readonly List<(IPAddress Network, int PrefixLength)> SharedNetworkRanges = new()
    {
        // Private networks
        (IPAddress.Parse("10.0.0.0"), 8),
        (IPAddress.Parse("172.16.0.0"), 12),
        (IPAddress.Parse("192.168.0.0"), 16),
        
        // Carrier-Grade NAT ranges
        (IPAddress.Parse("100.64.0.0"), 10),
        
        // Norske mobile carriers (eksempler)
        (IPAddress.Parse("85.166.0.0"), 16),  // Telenor
        (IPAddress.Parse("212.55.0.0"), 16),  // Telia
        (IPAddress.Parse("91.192.0.0"), 16),  // Ice/Tele2
    };

    public static string? GetClientIp(HttpContext context)
    {
        // Sjekk X-Forwarded-For først (proxy/CDN)
        var forwardedFor = context.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrEmpty(forwardedFor))
        {
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

    public static string? NormalizeIp(string? ipAddress)
    {
        if (string.IsNullOrEmpty(ipAddress)) return null;

        if (!IPAddress.TryParse(ipAddress, out var ip)) return null;

        // Konverter IPv4-mapped IPv6 til ren IPv4
        if (ip.IsIPv4MappedToIPv6)
        {
            ip = ip.MapToIPv4();
        }

        return ip.ToString();
    }

    /// <summary>
    /// Sjekker om request kommer fra mobile app basert på custom headers
    /// </summary>
    public static bool IsMobileAppRequest(HttpContext context)
    {
        var hasDeviceId = !string.IsNullOrEmpty(context.Request.Headers["X-Device-ID"]);
        var hasAppVersion = !string.IsNullOrEmpty(context.Request.Headers["X-App-Version"]);
        var hasPlatform = !string.IsNullOrEmpty(context.Request.Headers["X-Device-Platform"]);
        
        return hasDeviceId && (hasAppVersion || hasPlatform);
    }

    /// <summary>
    /// Sjekker om IP kommer fra shared network (mobilnettverk etc.)
    /// Inkluderer både IPv4 og IPv6 ranges
    /// </summary>
    public static bool IsFromSharedNetwork(string? ipAddress)
    {
        if (string.IsNullOrEmpty(ipAddress) || !IPAddress.TryParse(ipAddress, out var ip))
            return false;
            
        // IPv6 behandling
        if (ip.AddressFamily == System.Net.Sockets.AddressFamily.InterNetworkV6)
        {
            var bytes = ip.GetAddressBytes();
            
            // Private/local IPv6 ranges (RFC 4193 og RFC 3927)
            // fc00::/7 (Unique Local Addresses - ofte brukt i mobilnett)
            if ((bytes[0] & 0xFE) == 0xFC) 
                return true;
                
            // fe80::/10 (Link-local addresses)
            if (bytes[0] == 0xFE && (bytes[1] & 0xC0) == 0x80) 
                return true;
                
            // 2001:db8::/32 (Documentation range - ikke reelt, men kan forekomme i testing)
            if (bytes[0] == 0x20 && bytes[1] == 0x01 && bytes[2] == 0x0D && bytes[3] == 0xB8)
                return true;
                
            // Heuristikk: Telenor/Telia/Ice IPv6 ranges (må oppdateres basert på erfaring)
            // 2001:700::/29 (UNINETT/Telenor Norge)
            if (bytes[0] == 0x20 && bytes[1] == 0x01 && (bytes[2] & 0xF8) == 0x70 && bytes[3] == 0x00)
                return true;
                
            // For nå: anta at de fleste IPv6 er shared/mobile hvis de ikke er åpenbart private
            // Dette kan justeres basert på erfaring
            return true; // Konservativ tilnærming - behandle IPv6 som shared
        }
        
        // IPv4 behandling (som før)
        foreach (var (network, prefixLength) in SharedNetworkRanges)
        {
            if (IsInSubnet(ip, network, prefixLength))
                return true;
        }
        
        return false;
    }

    /// <summary>
    /// Genererer smart partition key for rate limiting
    /// Dropper IP på shared networks for bedre device-isolering
    /// </summary>
    public static string GetHybridPartitionKey(HttpContext context)
    {
        var clientIp = GetClientIp(context) ?? "unknown";
        var isSharedNetwork = IsFromSharedNetwork(clientIp);
        
        if (IsMobileAppRequest(context))
        {
            // For mobile: bruk device-spesifikke identifikatorer
            var deviceId = context.Request.Headers["X-Device-ID"].FirstOrDefault() ?? "unknown";
            var appVersion = context.Request.Headers["X-App-Version"].FirstOrDefault() ?? "unknown";
            var platform = context.Request.Headers["X-Device-Platform"].FirstOrDefault() ?? "unknown";
            var buildNumber = context.Request.Headers["X-Build-Number"].FirstOrDefault() ?? "unknown";
            
            var deviceFingerprint = ComputeFingerprint($"{deviceId}:{appVersion}:{platform}:{buildNumber}");
            
            if (isSharedNetwork)
            {
                // På shared networks: kun device fingerprint (ingen IP)
                return $"mobile-shared:{deviceFingerprint}";
            }
            else
            {
                // På private networks: IP + device fingerprint
                return $"mobile-private:{clientIp}:{deviceFingerprint}";
            }
        }
        else
        {
            // For web: bruk stabilisert browser fingerprinting
            var stableWebFingerprint = GetStableWebFingerprint(context);
            
            if (isSharedNetwork)
            {
                // På shared networks: primært device fingerprint
                return $"web-shared:{stableWebFingerprint}";
            }
            else
            {
                // På private networks: IP + device fingerprint  
                return $"web-private:{clientIp}:{stableWebFingerprint}";
            }
        }
    }

    /// <summary>
    /// Genererer stabil web fingerprint basert på browser family og major version
    /// </summary>
    private static string GetStableWebFingerprint(HttpContext context)
    {
        var userAgent = context.Request.Headers["User-Agent"].FirstOrDefault() ?? "unknown";
        var acceptLanguage = context.Request.Headers["Accept-Language"].FirstOrDefault() ?? "";
        
        // Parse browser info for stabilt fingerprint
        var (browserFamily, majorVersion) = ParseBrowserInfo(userAgent);
        
        // Forenklet språk (kun primært språk, ikke dialekter)
        var primaryLanguage = ParsePrimaryLanguage(acceptLanguage);
        
        var stableFingerprint = $"{browserFamily}:{majorVersion}:{primaryLanguage}";
        return ComputeFingerprint(stableFingerprint);
    }
    
    /// <summary>
    /// Parser browser info til family + major version
    /// </summary>
    private static (string family, string majorVersion) ParseBrowserInfo(string userAgent)
    {
        if (string.IsNullOrEmpty(userAgent))
            return ("unknown", "0");
            
        var ua = userAgent.ToLower();
        
        // Chrome/Chromium detection (inkluderer Edge)
        if (ua.Contains("chrome/"))
        {
            var match = System.Text.RegularExpressions.Regex.Match(ua, @"chrome/(\d+)");
            if (match.Success)
                return ("chrome", match.Groups[1].Value);
        }
        
        // Firefox detection
        if (ua.Contains("firefox/"))
        {
            var match = System.Text.RegularExpressions.Regex.Match(ua, @"firefox/(\d+)");
            if (match.Success)
                return ("firefox", match.Groups[1].Value);
        }
        
        // Safari detection (men ikke Chrome som inneholder Safari)
        if (ua.Contains("safari/") && !ua.Contains("chrome/"))
        {
            var match = System.Text.RegularExpressions.Regex.Match(ua, @"version/(\d+).*safari");
            if (match.Success)
                return ("safari", match.Groups[1].Value);
        }
        
        // Edge Legacy detection
        if (ua.Contains("edge/"))
        {
            var match = System.Text.RegularExpressions.Regex.Match(ua, @"edge/(\d+)");
            if (match.Success)
                return ("edge", match.Groups[1].Value);
        }
        
        // Internet Explorer
        if (ua.Contains("trident/") || ua.Contains("msie"))
        {
            var match = System.Text.RegularExpressions.Regex.Match(ua, @"(?:msie\s(\d+)|rv:(\d+))");
            if (match.Success)
                return ("ie", match.Groups[1].Value + match.Groups[2].Value);
        }
        
        // Fallback
        return ("unknown", "0");
    }
    
    /// <summary>
    /// Parser primært språk fra Accept-Language header
    /// </summary>
    private static string ParsePrimaryLanguage(string acceptLanguage)
    {
        if (string.IsNullOrEmpty(acceptLanguage))
            return "unknown";
            
        // Ta første språk og fjern region/dialect info
        var firstLang = acceptLanguage.Split(',')[0].Split(';')[0].Trim().ToLower();
        
        // Fjern region (en-US → en, nb-NO → nb)
        if (firstLang.Contains('-'))
            firstLang = firstLang.Split('-')[0];
            
        return firstLang;
    }

    /// <summary>
    /// Genererer kort fingerprint hash
    /// </summary>
    public static string GetMobileDeviceFingerprint(HttpContext context)
    {
        var deviceId = context.Request.Headers["X-Device-ID"].FirstOrDefault() ?? "unknown";
        var appVersion = context.Request.Headers["X-App-Version"].FirstOrDefault() ?? "unknown";
        var platform = context.Request.Headers["X-Device-Platform"].FirstOrDefault() ?? "unknown";
        
        return ComputeFingerprint($"{deviceId}:{appVersion}:{platform}");
    }

    private static string ComputeFingerprint(string input)
    {
        if (string.IsNullOrEmpty(input)) return "anonymous";
            
        using var sha256 = SHA256.Create();
        var hash = sha256.ComputeHash(Encoding.UTF8.GetBytes(input));
        
        // Returner første 12 chars for kortere nøkkel
        return Convert.ToBase64String(hash)[..12].Replace('+', '-').Replace('/', '_');
    }

    private static bool IsInSubnet(IPAddress address, IPAddress network, int prefixLength)
    {
        if (address.AddressFamily != network.AddressFamily)
            return false;
            
        var addressBytes = address.GetAddressBytes();
        var networkBytes = network.GetAddressBytes();
        
        var bytesToCheck = prefixLength / 8;
        var bitsToCheck = prefixLength % 8;
        
        // Check whole bytes
        for (int i = 0; i < bytesToCheck; i++)
        {
            if (addressBytes[i] != networkBytes[i])
                return false;
        }
        
        // Check remaining bits
        if (bitsToCheck > 0 && bytesToCheck < addressBytes.Length)
        {
            var mask = (byte)(0xFF << (8 - bitsToCheck));
            return (addressBytes[bytesToCheck] & mask) == (networkBytes[bytesToCheck] & mask);
        }
        
        return true;
    }
    
    /// <summary>
    /// Enkle, adaptive rate limits med kort vindu for bedre UX
    /// </summary>
    public static (int permitLimit, int windowMinutes) GetSimpleRateLimit(PathString path, bool isMobileApp, bool isSharedNetwork)
    {
        // Kort vindu for bedre UX - mindre "burst cutoff"-frustrasjon
        var window = 1; // 1 minutt for alle
        
        // Basis grenser
        int basePermit = path.Value?.ToLower() switch
        {
            var p when p.StartsWith("/api/auth", StringComparison.OrdinalIgnoreCase) => 12,
            var p when p.StartsWith("/api/chat", StringComparison.OrdinalIgnoreCase) => 90,
            _ => 60 // generelt API
        };
        
        // Bonus for mobil og/eller delt nettverk
        if (isMobileApp) basePermit += 20;
        if (isSharedNetwork) basePermit += 20;
        
        // Cap for auth - ikke la brute force bli for slapp
        if (path.Value?.StartsWith("/api/auth", StringComparison.OrdinalIgnoreCase) == true)
            basePermit = Math.Min(basePermit, 20);
            
        return (basePermit, window);
    }
}