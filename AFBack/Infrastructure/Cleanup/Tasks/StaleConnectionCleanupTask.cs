using AFBack.Features.SignalR.Repository;

namespace AFBack.Infrastructure.Cleanup.Tasks;

/// <summary>
/// Cleanup task for SignalR-connections som har blitt stående som "connected" i databasen
/// uten at de faktisk er aktive (f.eks. etter serverkrasj eller nettverksbrudd uten clean disconnect).
/// Markerer connections som disconnected hvis de har vært "connected" uten heartbeat-oppdatering
/// i mer enn StaleThreshold.
/// </summary>
public class StaleConnectionCleanupTask(
    IServiceScopeFactory scopeFactory,
    ILogger<StaleConnectionCleanupTask> logger) : ICleanupTask
{
    /// <summary>
    /// Connections uten heartbeat-oppdatering lenger enn dette regnes som stale.
    /// SignalR sender keepalive hvert 15. sekund, så 5 minutter er konservativt.
    /// </summary>
    private static readonly TimeSpan StaleThreshold = TimeSpan.FromMinutes(5);

    public string TaskName => "StaleConnectionCleanup";
    public TimeSpan Interval => TimeSpan.FromMinutes(5);
    public TimeSpan InitialDelay => TimeSpan.FromMinutes(2);

    public async Task ExecuteAsync(CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IUserConnectionRepository>();

        var cutoff = DateTime.UtcNow.Subtract(StaleThreshold);
        var deletedCount = await repository.DeleteStaleConnectionsAsync(cutoff, cancellationToken);

        if (deletedCount > 0)
            logger.LogInformation("Deleted {Count} stale SignalR connections", deletedCount);
    }
}
