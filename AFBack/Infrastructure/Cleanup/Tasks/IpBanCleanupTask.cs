using AFBack.Infrastructure.Security.Services;


namespace AFBack.Infrastructure.Cleanup.Tasks;

/// <summary>
/// Cleanup task for IP-ban systemet.
/// Rydder utløpte bans fra cache og database via IpBanService,
/// og sletter gamle SuspiciousActivity-rader som ikke lenger er relevante.
/// </summary>
public class IpBanCleanupTask(IIpBanService ipBanService) : ICleanupTask
{
    public string TaskName => "IpBanCleanup";
    public TimeSpan Interval => TimeSpan.FromHours(1);
    public TimeSpan InitialDelay => TimeSpan.FromMinutes(5);

    public async Task ExecuteAsync(CancellationToken ct) =>
        await ipBanService.ClearExpiredFromCacheAsync(ct);
    
}
