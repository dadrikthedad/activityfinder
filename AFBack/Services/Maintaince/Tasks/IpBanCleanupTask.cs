using AFBack.Interface;
using AFBack.Services.Maintenance;
using AFBack.Configuration;
using Microsoft.Extensions.Options;
using Microsoft.EntityFrameworkCore;
using AFBack.Data;
using AFBack.Constants;
using AFBack.Interface.Services;

namespace AFBack.Services.Maintenance.Tasks;

public class IpBanCleanupTask(
    IServiceProvider serviceProvider,
    ILogger<IpBanCleanupTask> logger,
    IIpBanService ipBanService,
    IOptions<IpBanOptions> options)
    : CleanupTaskBase(serviceProvider, logger)
{
    private readonly IIpBanService _ipBanService = ipBanService;
    private readonly IpBanOptions _options = options.Value;

    public override string TaskName => "IP Ban Cleanup";
    public override TimeSpan Interval => _options.CleanupInterval;
    public override TimeSpan InitialDelay => TimeSpan.FromMinutes(5);

    public override Task ExecuteAsync(CancellationToken cancellationToken)
    {
        return RunWithErrorHandlingAsync(async () =>
        {
            var stopwatch = System.Diagnostics.Stopwatch.StartNew();
            
            using var scope = ServiceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var now = DateTime.UtcNow;
            var cleanupCutoff = now.Subtract(_options.SuspiciousWindow.Add(TimeSpan.FromDays(7)));

            // Bulk update expired temporary bans
            var expiredBansCount = await context.BanInfos
                .Where(b => b.IsActive && b.BanType == BanType.Temporary && now > b.ExpiresAt)
                .ExecuteUpdateAsync(setters => setters.SetProperty(b => b.IsActive, false));

            // Bulk delete old suspicious activities
            var deletedActivitiesCount = await context.SuspiciousActivities
                .Where(s => s.Timestamp < cleanupCutoff)
                .ExecuteDeleteAsync();

            // Clear expired bans from cache
            _ipBanService.ClearExpiredFromCache();

            stopwatch.Stop();

            if (expiredBansCount > 0 || deletedActivitiesCount > 0)
            {
                Logger.LogInformation("IP ban cleanup completed in {Duration}ms: deactivated {ExpiredBans} expired bans, deleted {OldActivities} old suspicious activities",
                    stopwatch.ElapsedMilliseconds, expiredBansCount, deletedActivitiesCount);
            }
            else
            {
                Logger.LogDebug("IP ban cleanup completed in {Duration}ms: no expired data found",
                    stopwatch.ElapsedMilliseconds);
            }
            
        }, cancellationToken);
    }
}
