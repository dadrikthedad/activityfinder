using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace AFBack.Infrastructure.Security.Utils;

public class FingerprintUtils
{
    /// <summary>
    /// Oppretter en DeviceFingerPrint utifra det som er i headeren på forespørselen.
    /// Hvis ingen brukerId på forespørselen, så lager vi en "ID" med detaljer fra headeren
    /// Fingerprint bruker deviceId, appVersion, platform og buildNumber
    /// </summary>
    /// <param name="context">Forespørselen</param>
    /// <returns>En string med fingerprint</returns>
    public static string GetMobileDeviceFingerprint(HttpContext context)
    {
        var deviceId = context.Request.Headers["X-Device-ID"].FirstOrDefault() ?? "unknown";
        var appVersion = context.Request.Headers["X-App-Version"].FirstOrDefault() ?? "unknown";
        var platform = context.Request.Headers["X-Device-Platform"].FirstOrDefault() ?? "unknown";
        var buildNumber = context.Request.Headers["X-Build-Number"].FirstOrDefault() ?? "unknown";

        return ComputeFingerprint($"{deviceId}:{appVersion}:{platform}:{buildNumber}");
    }
    
    /// <summary>
    /// Oppretter en WebFingerprint utifra headeren på forespørselen.
    /// Inneholder UserAgent fra nettleseren, foretrukket språk (men stripper vekk regionen,
    /// så det blir nb og ikke nb-NO g hvilken BrowserFamilie
    /// </summary>
    /// <param name="context"></param>
    /// <returns>En string med fingerprint</returns>
    public static string GetWebFingerprint(HttpContext context)
    {
        var userAgent = context.Request.Headers["User-Agent"].FirstOrDefault() ?? "unknown";
        var acceptLanguage = context.Request.Headers["Accept-Language"].FirstOrDefault() ?? "";

        var (browserFamily, majorVersion) = ParseBrowserInfo(userAgent);
        var primaryLanguage = ParsePrimaryLanguage(acceptLanguage);

        return ComputeFingerprint($"{browserFamily}:{majorVersion}:{primaryLanguage}");
    }
    
    /// <summary>
    /// Henter browser familien utifra UserAgent i headeren
    /// </summary>
    /// <param name="userAgent">Nettleseren sin UserAgent</param>
    /// <returns>Tuple med (browser-Familien, og versjonen)</returns>
    private static (string family, string majorVersion) ParseBrowserInfo(string userAgent)
    {
        // Tom userAgent - returner unknown og 0. Forsatt gyldig da den blir kombinert med IP-en
        if (string.IsNullOrEmpty(userAgent))
            return ("unknown", "0");
        
        // Må ha den i små bokstaver for å sammenligne
        var ua = userAgent.ToLower();
        
        // Sjekker familien utifra hva som står i headeren
        if (ua.Contains("chrome/"))
        {
            var match = Regex.Match(ua, @"chrome/(\d+)");
            if (match.Success) return ("chrome", match.Groups[1].Value);
        }

        if (ua.Contains("firefox/"))
        {
            var match = Regex.Match(ua, @"firefox/(\d+)");
            if (match.Success) return ("firefox", match.Groups[1].Value);
        }

        if (ua.Contains("safari/") && !ua.Contains("chrome/"))
        {
            var match = Regex.Match(ua, @"version/(\d+).*safari");
            if (match.Success) return ("safari", match.Groups[1].Value);
        }

        if (ua.Contains("edge/"))
        {
            var match = Regex.Match(ua, @"edge/(\d+)");
            if (match.Success) return ("edge", match.Groups[1].Value);
        }
        
        // Kan legge på flere her eventuelt
        
        return ("unknown", "0");
    }
    
    /// <summary>
    /// Splitter vekk de andre språkene, og tar kun hovedspråket, og deretter fjernes kvalitets-vekten.
    /// Og til slutt fjener vi regions koden fordi vi trenger kun språk familien
    /// </summary>
    /// <param name="acceptLanguage">En string med preffed language fra nettleseren</param>
    /// <returns>En string med det foresprukne språket (feks 'nb')</returns>
    private static string ParsePrimaryLanguage(string acceptLanguage)
    {   
        // Tom string, returner unknown
        if (string.IsNullOrEmpty(acceptLanguage))
            return "unknown";
        
        // Henter ut det første språket ved å splitte på ",", så ";"
        var firstLang = acceptLanguage.Split(',')[0].Split(';')[0].Trim().ToLower();
        
        // Fjerner regionen
        if (firstLang.Contains('-'))
            firstLang = firstLang.Split('-')[0];
        
        return firstLang;
    }
    
    /// <summary>
    /// Hasher input-strengen med SHA256 og returnerer de første 12 tegnene som URL-safe base64.
    /// Brukes for å lage korte, konsistente partition keys fra fingerprint-data og skjule snesitiv informasjon.
    /// </summary>
    /// <param name="input">Strengen som skal hashes (f.eks. "chrome:131:nb")</param>
    /// <returns>12 tegn URL-safe base64-hash, eller "anonymous" hvis input er tom</returns>
    private static string ComputeFingerprint(string input)
    {
        // Tom string, ingenting å hashe
        if (string.IsNullOrEmpty(input)) 
            return "anonymous";
        
        // Hasher det med SHA256
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        // Fjerner + og / som kan skape problemer i nøkkelen
        return Convert.ToBase64String(hash)[..12].Replace('+', '-').Replace('/', '_');
    }
}
