using AFBack.Configurations.Options;
using AFBack.Infrastructure.Security.Enums;
using AFBack.Infrastructure.Security.Models;
using AFBack.Infrastructure.Security.Repositories;
using AFBack.Infrastructure.Security.Utils;

namespace AFBack.Infrastructure.Security.Services;

public class SuspiciousActivityService(
    IIpBanService ipBanService,
    IServiceScopeFactory scopeFactory,
    ILogger<SuspiciousActivityService> logger)
    : ISuspiciousActivityService
{
    /// <inheritdoc />
    public async Task ReportSuspiciousActivityAsync(
        string ipAddress, 
        SuspiciousActivityType activityType, 
        string reason,
        string? deviceFingerprint = null,
        string? userId = null,
        string? userAgent = null, 
        string? endpoint = null
        )
    {  
        // Normaliserer Ip-en og validerer at den er gyldig
        var normalizedIp = IpUtils.NormalizeIpAdress(ipAddress);
        if (string.IsNullOrEmpty(normalizedIp))
        {
            logger.LogWarning("Invalid IP address reported: {IpAddress}", ipAddress);
            return;
        }
        
        // Ikke ban egne IP-er 
        if (ipBanService.IsWhitelisted(normalizedIp))
            return;
        
        // Sjekker om brukeren allerede er bannet
        if (await ipBanService.IsIpBannedAsync(normalizedIp))
        {
            logger.LogDebug("Ignoring suspicious activity from already banned IP {IP}", normalizedIp);
            return;
        }

        using var scope = scopeFactory.CreateScope();
        var ipBanRepository = scope.ServiceProvider.GetRequiredService<IIpBanRepository>();
        var suspiciousActivityRepository = scope.ServiceProvider.GetRequiredService<ISuspiciousActivityRepository>();
        
        // Henter userDevice til brukeren for å hente ut ID-en
        int? userDeviceId = null;
        if (!string.IsNullOrEmpty(userId) && !string.IsNullOrEmpty(deviceFingerprint))
        {
            var userDevice = await ipBanRepository.GetUserDeviceIdAsync(userId, deviceFingerprint);
            if (userDevice == null)
            {
                logger.LogWarning("No registrated user device for {UserId} with fingerprint {DeviceFingerprint}. " +
                                   "Ip: {IP}",
                    userId, deviceFingerprint, ipAddress);
                return;
            }
                
            userDeviceId = userDevice.Id;
        }

        // Lagre aktiviteten
        var activity = new SuspiciousActivity
        {
            IpAddress = normalizedIp,
            UserId = userId,
            UserDeviceId = userDeviceId,
            ActivityType = activityType,
            Reason = reason,
            Timestamp = DateTime.UtcNow,
            UserAgent = userAgent,
            Endpoint = endpoint
        };
        
        // lagerer i databasen
        await suspiciousActivityRepository.AddSuspiciousActivity(activity);
        
        // === Sjekk om vi har nådd terskelen for auto-ban ====
        // Finner tidsvindue som er gjeldene for mistenksomme handlinger
        var suspiciousWindowStart  = DateTime.UtcNow.Subtract(IpBanConfig.SuspiciousWindow);
        
        // Henter antall mistenksomme aktiviterer
        var recentCount = await suspiciousActivityRepository.GetSuspiciousActivitiesCountAsync(normalizedIp, 
            suspiciousWindowStart);
        
        // Nok mistenksomme handlinger, ban brukeren
        if (recentCount >= IpBanConfig.MaxSuspiciousAttempts)
        {
            await ipBanService.BanIpAsync(normalizedIp, BanType.Temporary,
                $"Auto-banned after {recentCount} suspicious " +
                $"activities within {IpBanConfig.SuspiciousWindow.TotalHours}h");
            
        }
        else
        {
            logger.LogWarning("Suspicious activity from {IP}: {Reason} ({Count}/{Threshold})",
                normalizedIp, reason, recentCount, IpBanConfig.MaxSuspiciousAttempts);
        }
    }
}

    
