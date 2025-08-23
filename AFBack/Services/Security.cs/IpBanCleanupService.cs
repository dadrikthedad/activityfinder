using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using AFBack.Configuration;
using AFBack.Constants;
using AFBack.Data;
using AFBack.Models;

namespace AFBack.Services;

public class IpBanCleanupService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<IpBanCleanupService> _logger;
    private readonly IpBanService _ipBanService;
    private readonly IpBanOptions _options;

    public IpBanCleanupService(
        IServiceScopeFactory scopeFactory, 
        ILogger<IpBanCleanupService> logger,
        IpBanService ipBanService,
        IOptions<IpBanOptions> options)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _ipBanService = ipBanService;
        _options = options.Value;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(_options.CleanupInterval);
        
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await timer.WaitForNextTickAsync(stoppingToken);
                await PerformCleanupAsync();
            }
            catch (OperationCanceledException)
            {
                // Expected when cancellation is requested
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during IP ban cleanup");
            }
        }
    }

    private async Task PerformCleanupAsync()
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var now = DateTime.UtcNow;
            // Hold suspicious data i 7 dager ekstra etter suspicious window
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

            if (expiredBansCount > 0 || deletedActivitiesCount > 0)
            {
                _logger.LogInformation("Cleanup completed: deactivated {ExpiredBans} expired bans, deleted {OldActivities} old suspicious activities",
                    expiredBansCount, deletedActivitiesCount);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during IP ban cleanup");
        }
    }
}