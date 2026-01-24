using AFBack.Features.SyncEvents.Services;
using AFBack.Interface.Services;

namespace AFBack.Services.Maintenance.Tasks;

public class SyncEventsCleanupTask : CleanupTaskBase
{
    public override string TaskName => "Sync Events Cleanup";
    public override TimeSpan Interval => TimeSpan.FromHours(24);
    public override TimeSpan InitialDelay => TimeSpan.FromMinutes(5);

    public SyncEventsCleanupTask(IServiceProvider serviceProvider, ILogger<SyncEventsCleanupTask> logger) 
        : base(serviceProvider, logger) { }

    public override Task ExecuteAsync(CancellationToken cancellationToken)
    {
        return RunWithErrorHandlingAsync(async () =>
        {
            using var scope = ServiceProvider.CreateScope();
            var syncService = scope.ServiceProvider.GetRequiredService<ISyncService>();
            await syncService.CleanupOldEventsAsync();
            Logger.LogDebug("Completed sync events cleanup");
        }, cancellationToken);
    }
}
