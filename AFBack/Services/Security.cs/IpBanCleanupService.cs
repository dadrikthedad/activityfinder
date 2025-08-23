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
        // Vent litt før første cleanup for å la applikasjonen starte opp ordentlig
        await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
        
        using var timer = new PeriodicTimer(_options.CleanupInterval);
        
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await timer.WaitForNextTickAsync(stoppingToken);
                
                if (!stoppingToken.IsCancellationRequested)
                {
                    await PerformCleanupAsync();
                }
            }
            catch (OperationCanceledException)
            {
                // Expected when cancellation is requested
                _logger.LogInformation("IP ban cleanup service is shutting down");
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during IP ban cleanup");
                
                // Vent litt ekstra ved feil for å unngå spam av feilmeldinger
                try
                {
                    await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }
        }
    }

    private async Task PerformCleanupAsync()
    {
        var stopwatch = System.Diagnostics.Stopwatch.StartNew();
        
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

            stopwatch.Stop();

            if (expiredBansCount > 0 || deletedActivitiesCount > 0)
            {
                _logger.LogInformation("Cleanup completed in {Duration}ms: deactivated {ExpiredBans} expired bans, deleted {OldActivities} old suspicious activities",
                    stopwatch.ElapsedMilliseconds, expiredBansCount, deletedActivitiesCount);
            }
            else
            {
                _logger.LogDebug("Cleanup completed in {Duration}ms: no expired data found",
                    stopwatch.ElapsedMilliseconds);
            }
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            _logger.LogError(ex, "Error during IP ban cleanup after {Duration}ms", stopwatch.ElapsedMilliseconds);
            throw; // Re-throw for outer exception handling
        }
    }

    public override async Task StopAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("IP ban cleanup service is stopping");
        await base.StopAsync(stoppingToken);
    }
}