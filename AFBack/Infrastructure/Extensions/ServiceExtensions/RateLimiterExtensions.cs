using System.Threading.RateLimiting;
using AFBack.Configurations.Options;
using AFBack.Infrastructure.Security.RateLimiting;
using AFBack.Infrastructure.Security.Utils;
using AFBack.Interface.Services;
using AFBack.Models.Enums;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Caching.Memory;

namespace AFBack.Infrastructure.Extensions.ServiceExtensions;

public static class RateLimiterExtensions
{
    /// <summary>
    /// Konfigurerer rate limiting med bruker-ID-basert partisjonering.
    /// 
    /// Autentiserte brukere: rate limit per bruker-ID (IP er irrelevant).
    /// Uautentiserte brukere: rate limit per IP + device/browser fingerprint.
    /// </summary>
    public static IServiceCollection AddCustomRateLimiter(this IServiceCollection services)
    {
        services.AddRateLimiter(options =>
        {
            // === GLOBAL LIMITER ===
            // Sikkerhetsnett for alle endepunkter. Policyer kjører i tillegg til denne.
            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
            {
                // Henter ut en nøkkel utifra om det er en bruker, web eller mobil som sender forespørselen
                var partitionKey = RateLimitHelper.GetPartitionKey(context);
                
                // Denne forespørselen havner i en bøtte, slik at brukeren ikke kan spamme API-et
                return RateLimitPartition.GetSlidingWindowLimiter(partitionKey, _ =>
                    new SlidingWindowRateLimiterOptions
                    {
                        PermitLimit = RateLimitConfig.GlobalPermitLimit,
                        Window = TimeSpan.FromMinutes(RateLimitConfig.GlobalWindowMinutes),
                        SegmentsPerWindow = RateLimitConfig.GlobalSegmentsPerWindow,
                        QueueLimit = RateLimitConfig.GlobalQueueLimit,
                    });
            });

            // === AUTH POLICY ===
            // Streng for Login, register, email-verifisering. Alltid uautentisert → IP + fingerprint.
            options.AddPolicy("auth", context =>
            {
                var partitionKey = RateLimitHelper.GetPartitionKey(context);

                return RateLimitPartition.GetSlidingWindowLimiter(partitionKey, _ =>
                    new SlidingWindowRateLimiterOptions
                    {
                        PermitLimit = RateLimitConfig.AuthPermitLimit,
                        Window = TimeSpan.FromMinutes(RateLimitConfig.AuthWindowMinutes),
                        SegmentsPerWindow = RateLimitConfig.AuthSegmentsPerWindow,
                        QueueLimit = RateLimitConfig.AuthQueueLimit
                    });
            });

            // === MESSAGING POLICY ===
            // Hot-path, ikke streng. Chat-meldinger. Alltid autentisert → partisjoneres per bruker-ID.
            options.AddPolicy("messaging", context =>
            {
                var partitionKey = RateLimitHelper.GetPartitionKey(context);

                return RateLimitPartition.GetSlidingWindowLimiter(partitionKey, _ =>
                    new SlidingWindowRateLimiterOptions
                    {
                        PermitLimit = RateLimitConfig.MessagingPermitLimit,
                        Window = TimeSpan.FromMinutes(RateLimitConfig.MessagingWindowMinutes),
                        SegmentsPerWindow = RateLimitConfig.MessagingSegmentsPerWindow,
                        QueueLimit = RateLimitConfig.MessagingQueueLimit
                    });
            });

            // === PUBLIC POLICY ===
            // Offentlige endepunkter med høy kapasitet
            options.AddPolicy("public", context =>
            {
                var partitionKey = RateLimitHelper.GetPartitionKey(context);

                return RateLimitPartition.GetSlidingWindowLimiter(partitionKey, _ =>
                    new SlidingWindowRateLimiterOptions
                    {
                        PermitLimit = RateLimitConfig.PublicPermitLimit,
                        Window = TimeSpan.FromMinutes(RateLimitConfig.PublicWindowMinutes),
                        SegmentsPerWindow = RateLimitConfig.PublicSegmentsPerWindow,
                        QueueLimit = RateLimitConfig.PublicQueueLimit
                    });
            });
            
            // Hvis brukeren blir fanget opp av ratelimiteren så kjører vi HandleRateLimitRejection
            options.OnRejected = HandleRateLimitRejection;
            options.RejectionStatusCode = 429;
        });

        return services;
    }

    /// <summary>
    /// Håndterer strikes og banner brukere som overskrider rate limits gjentatte ganger.
    /// </summary>
    /// <param name="context">Http-forespørselen</param>
    /// <param name="cancellationToken"></param>
    private static async ValueTask HandleRateLimitRejection(OnRejectedContext context, 
        CancellationToken cancellationToken)
    {
        // Http-forespørselen
        var httpContext = context.HttpContext;
        // Henter den unike nøkkelen for denne brukeren
        var partitionKey = RateLimitHelper.GetPartitionKey(httpContext);
        // Henter IP-en til klienten
        var clientIp = IpUtils.GetClientIp(httpContext) ?? "unknown";
        // Henter brukerId eller null
        var userId = httpContext.User.GetUserIdOrDefault();
        // Sjekker om det er via mobilappen
        var isMobile = IpUtils.IsMobileAppRequest(httpContext);
        // henter deviceId eller null utifra om det er en mobil
        var deviceId = isMobile
            ? httpContext.Request.Headers["X-Device-ID"].FirstOrDefault()
            : null;

        // Retry-After header - returnes til frontend og frontend vet da at den ikke trenger å sende ny requester
        // før telleren har telt ned
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
        {
            // Max gjør vi ikke sender 0 sekunder, og vi runder opp med Ceiling.
            httpContext.Response.Headers["Retry-After"] =
                Math.Max(1, (int)Math.Ceiling(retryAfter.TotalSeconds)).ToString();
        }
        
        // Henter cache og logger for å lagre det
        var cache = httpContext.RequestServices.GetService<IMemoryCache>();
        var logger = httpContext.RequestServices.GetService<ILogger<Program>>();

        if (cache != null && logger != null)
        {   
            // Nøkkelene i memory cache for å lagre partitionKey i cache med egen prefix for å finne igjen
            var strikeKey = $"rl-strikes:{partitionKey}";
            // Henter antall minuter bruker blir utestengt
            var strikeWindow = TimeSpan.FromMinutes(RateLimitConfig.StrikeWindowMinutes);
            
            // Henter strikeKey fra cachen, eller oppretter en ny med strike 0
            var strikes = cache.GetOrCreate(strikeKey, entry =>
            {
                // Strike-telleren utløper etter StrikeWindowMinutes (feks 10 min) og starter på 0
                entry.AbsoluteExpirationRelativeToNow = strikeWindow;
                return 0;
            });
            
            // Øker striken for hver rejected forespørsel
            strikes++;
            // lagerer i Cache igjen
            cache.Set(strikeKey, strikes, strikeWindow);
            
            // Henter ut brukerId og deviceInfo for logging og opprettelse av Suspicious Activites
            var deviceInfo = !string.IsNullOrEmpty(deviceId)
                ? $" Device: {deviceId[..Math.Min(8, deviceId.Length)]}..."
                : "";
            var userInfo = userId != null ? $" User: {userId}" : "";
            
            // Logger en vanlig Information hvis det er en under 3 strikes
            if (strikes < RateLimitConfig.StrikesBeforeBan - 2)
            {
                logger.LogInformation(
                    "Rate limit hit (strike {Strike}) - {Type} from {IP}{UserInfo}{DeviceInfo} on {Path}",
                    strikes, isMobile ? "Mobile" : "Web", clientIp, userInfo, deviceInfo,
                    httpContext.Request.Path);
            } // Over 3 strikes så logger vi en warning
            else if (strikes < RateLimitConfig.StrikesBeforeBan)
            {
                logger.LogWarning(
                    "Rate limit warning (strike {Strike}/{Threshold}) - {Type} from {IP}{UserInfo}{DeviceInfo} on {Path}",
                    strikes, RateLimitConfig.StrikesBeforeBan, isMobile ? "Mobile" : "Web",
                    clientIp, userInfo, deviceInfo, httpContext.Request.Path);
            } // Det blir da opprettet en SuspiciousActivity hvis vi er på limiten
            else
            {
                var ipBanService = httpContext.RequestServices.GetService<IIpBanService>();
                if (ipBanService != null)
                {
                    // TODO: Må fikse her
                    await ipBanService.ReportSuspiciousActivityAsync(
                        clientIp,
                        SuspiciousActivityType.RateLimitExceeded,
                        $"Rate limit violations (strike {strikes}){userInfo}",
                        httpContext.Request.Headers["User-Agent"].ToString(),
                        httpContext.Request.Path,
                        deviceId);

                    logger.LogWarning(
                        "Rate limit BAN (strike {Strike}/{Threshold}) - {Type} from {IP}{UserInfo}{DeviceInfo} on {Path}",
                        strikes, RateLimitConfig.StrikesBeforeBan, isMobile ? "Mobile" : "Web",
                        clientIp, userInfo, deviceInfo, httpContext.Request.Path);
                }
            }
        }

        httpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        await httpContext.Response.WriteAsync("Too many requests. Please slow down.", cancellationToken);
    }
}
