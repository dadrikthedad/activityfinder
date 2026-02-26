using AFBack.Configurations.Options;
using AFBack.Features.SyncEvents.Services;

namespace AFBack.Infrastructure.Cleanup.Tasks;

/// <summary>
/// Cleanup task for SyncEvent-tabellen.
/// Sletter events eldre enn InactivityThreshold, siden enheter som har vært inaktive
/// lenger enn dette uansett trigges til full bootstrap via DeviceSyncState.
/// </summary>
public class SyncEventsCleanupTask(
    IServiceScopeFactory scopeFactory,
    ILogger<SyncEventsCleanupTask> logger) : ICleanupTask
{
    public string TaskName => "SyncEventsCleanup";
    public TimeSpan Interval => SyncEventConfig.CleanupInterval;
    public TimeSpan InitialDelay => SyncEventConfig.CleanupInitialDelay;

    public async Task ExecuteAsync(CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var syncService = scope.ServiceProvider.GetRequiredService<ISyncService>();

        await syncService.CleanupOldEventsAsync(cancellationToken);

        logger.LogDebug("Sync events cleanup completed");
    }
}
