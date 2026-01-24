using System.Threading.RateLimiting;
using AFBack.Interface.Services;
using AFBack.Services;
using AFBack.Utils;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Caching.Memory;

namespace AFBack.Infrastructure.Extensions;

// Sparer oss fra å fylle opp Program.cs med masse kode
// Her styrer vi RateLimit
public static class RateLimiterExtensions
{   
    /// <summary>
    /// Tar imot IServiceCollection-objektet og legger til custom Rate limiter.
    /// Vi lager GlobalLimit som er et sikkerhetsnett for alle endepunkter, og policyer som brukes på kontrollerne våre
    /// </summary>
    /// <param name="services"></param>
    /// <returns></returns>
    public static IServiceCollection AddCustomRateLimiter(this IServiceCollection services)
    {
        // Vi legger på den innebygde ratelimitiren og gir den innstillinger
        services.AddRateLimiter(options =>
        {
            // Sikkerhets for hele appen. Legger på GlobalLimit her. PartitionedRateLimiter og create lager
            // regler for hva som styrer ratelimiten
            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
            {
                // Skiller mellom forskjellige klienter
                var partitionKey = IpUtils.GetHybridPartitionKey(context);
                // Vi sjekker om det er på en mobil da de kan ha delt nettverk
                var isMobile = IpUtils.IsMobileAppRequest(context);
                // Sjekker om vi er bak delt nettverk
                var isShared = IpUtils.IsFromSharedNetwork(IpUtils.GetClientIp(context));

                // Dette er selve Limiteren. PermitLimit er antall requester på et delt nettverk,
                // på et tidsvindu på 1 min og hvor mange requester som kan stå i kø
                return RateLimitPartition.GetSlidingWindowLimiter(partitionKey, _ =>
                    new SlidingWindowRateLimiterOptions
                    {
                        PermitLimit = isShared ? 300 : 150,
                        Window = TimeSpan.FromMinutes(1),
                        SegmentsPerWindow = 4,
                        QueueLimit = isMobile ? 10 : 5,
                    });
            });

            // Her lager vi en policy som brukes på auth-endepunkter. Lite trafikk, og sikkerhet er viktig
            options.AddPolicy("auth", context =>
            {
                var partitionKey = IpUtils.GetHybridPartitionKey(context);
                var isShared = IpUtils.IsFromSharedNetwork(IpUtils.GetClientIp(context));

                return RateLimitPartition.GetSlidingWindowLimiter(partitionKey, _ => new
                    SlidingWindowRateLimiterOptions
                    {
                        PermitLimit = isShared ? 10 : 5,
                        Window = TimeSpan.FromMinutes(5),
                        SegmentsPerWindow = 2,
                        QueueLimit = 0
                    });
            });

            // Her lager vi en policy som brukes på messaging. Mye trafikk
            options.AddPolicy("messaging", context =>
            {
                var partitionKey = IpUtils.GetHybridPartitionKey(context);
                var isMobile = IpUtils.IsMobileAppRequest(context);

                return RateLimitPartition.GetSlidingWindowLimiter(partitionKey, _ => new
                    SlidingWindowRateLimiterOptions
                    {
                        PermitLimit = 100,
                        Window = TimeSpan.FromMinutes(1),
                        SegmentsPerWindow = 6,
                        QueueLimit = isMobile ? 20 : 10
                    });
            });
            
            // Her lager vi et public endepunkt som kan brukes mye TODO: Gjør den sikrere
            options.AddPolicy("public", context =>
            {
                var partitionKey = IpUtils.GetHybridPartitionKey(context);

                return RateLimitPartition.GetSlidingWindowLimiter(partitionKey, _ => new
                    SlidingWindowRateLimiterOptions
                    {
                        PermitLimit = 500,
                        Window = TimeSpan.FromMinutes(1),
                        SegmentsPerWindow = 4,
                        QueueLimit = 50
                    });
            });

            options.OnRejected = HandleRateLimitRejection;
            options.RejectionStatusCode = 429;
            
        });

        return services;
    }
    
    
    /// <summary>
    /// Her håndtere vi strikes og hvis en bruker får mange nok strikes så blir de midlertidig/permanent bannet.
    /// Denne metoden kjøres kun hvis en rate limit blir nådd
    /// </summary>
    /// <param name="context"></param>
    /// <param name="cancellationToken"></param>
    private static async ValueTask HandleRateLimitRejection(
        OnRejectedContext context, CancellationToken cancellationToken)
    {
        // Her henter vi ut HttpContexten
        var httpContext = context.HttpContext;
        // GetHybridPartitionKey returnerer en nøkkel basert på om det er en mobil/nettlser, delt nettverk, og om det er
        // et device-fingerprint. Sikrer at vi ikke banner alle som har samme Ip
        var partitionKey = IpUtils.GetHybridPartitionKey(httpContext);
        // Hneter Ipen
        var clientIp = IpUtils.GetClientIp(httpContext) ?? "unknown";
        // Vi sjekker om det er en mobil app reqwuest
        var isMobile = IpUtils.IsMobileAppRequest(httpContext);
        // Sjekker om det er på et delt nettverk
        var isShared = IpUtils.IsFromSharedNetwork(clientIp);
        // Henter deviceId hvis den finnes
        var deviceId = isMobile
            ? httpContext.Request.Headers["X-Device-ID"].FirstOrDefault()
            : null;
        
        // Denne headeren sier til brukeren hvor mange minutter før de kan prøve igjen
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
        {   
            httpContext.Response.Headers["Retry-After"] =
                Math.Max(1, (int)Math.Ceiling(retryAfter.TotalSeconds)).ToString();
        }
        
        // Henter cache og logging når en Limit blir nådd
        var cache = httpContext.RequestServices.GetService<IMemoryCache>();
        var logger = httpContext.RequestServices.GetService<ILogger<Program>>();
        
        // Sirker at vi ikke får nullRefenceException
        if (cache != null && logger != null)
        {
            // Vi lager en unik nøkkel for denne klienten
            var strikeKey = $"rl-strikes:{partitionKey}";
            
            // Her lager vi eller henter antall strikes
            var strikes = cache.GetOrCreate(strikeKey, entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10);
                return 0;
            });
            
            // Legger på en strike
            strikes++;
            // Lagrer i cache igjen
            cache.Set(strikeKey, strikes, TimeSpan.FromMinutes(10));
            
            // Henter deviceInfo - for å anonymifisere så henter vi kun noen av tallene
            var deviceInfo = !string.IsNullOrEmpty(deviceId) ? $" Device: {deviceId[..8]}..." : "";
            
            // Hvis det er mindre en 3 strikes eller vi er på delt nettverk. Logger en strike
            if (strikes <= 3 || isShared)
            {
                logger.LogInformation("Rate limit hit (strike {Strike}) - {Type} from {IP}{DeviceInfo} on {Path}",
                    strikes, isMobile ? "Mobile" : "Web", clientIp, deviceInfo, httpContext.Request.Path);
            }
            // Hvis det er 5 eller flere strikes og vi ikke er på delt nettverk så er det ban
            else if (strikes >= 5 && !isShared)
            {
                // Henter ipBanService
                var ipBanService = httpContext.RequestServices.GetService<IIpBanService>();
                if (ipBanService != null)
                {
                    // Lgger til aktivitetstypen utifra hvilket endepunkt brukeren prøvde å nå
                    var activityType = httpContext.Request.Path.StartsWithSegments("/api/auth")
                        ? SuspiciousActivityTypes.LOGIN_ATTEMPT
                        : SuspiciousActivityTypes.API_ABUSE;
                    
                    // Lagrer i databasen at brukeren er bannet
                    await ipBanService.ReportSuspiciousActivityAsync(
                        clientIp,
                        activityType,
                        $"Repeated rate limit violations (strike {strikes})",
                        httpContext.Request.Headers["AppUser-Agent"].ToString(),
                        httpContext.Request.Path,
                        deviceId);
                    
                    logger.LogInformation("Repeated rate limit violations (strike {Strike}) - {Type} from {IP}{DeviceInfo} on {Path}",
                        strikes, isMobile ? "Mobile" : "Web", clientIp, deviceInfo, httpContext.Request.Path);
                }
                
            }
            // Andre tilfeller så logger vi bare at noen nærmer seg en ban
            else
                logger.LogWarning("Repeated rate limit hit (strike {Strike}) - {Type} from {IP}{DeviceInfo} on {Path}",
                    strikes, isMobile ? "Mobile" : "Web", clientIp, deviceInfo, httpContext.Request.Path);

            
        }
        
        // Legger til responsen
        httpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        await httpContext.Response.WriteAsync("Too many requests. Please slow down.",
            cancellationToken);
    }
}
