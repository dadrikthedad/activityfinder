using AFBack.Services.Maintenance;

namespace AFBack.Services.Maintenance.Tasks;

public class OnlineStatusCleanupTask : CleanupTaskBase
{
    public override string TaskName => "Online Status Cleanup";
    public override TimeSpan Interval => TimeSpan.FromMinutes(2);

    public OnlineStatusCleanupTask(IServiceProvider serviceProvider, ILogger<OnlineStatusCleanupTask> logger) 
        : base(serviceProvider, logger) { }

    public override Task ExecuteAsync(CancellationToken cancellationToken)
    {
        return RunWithErrorHandlingAsync(async () =>
        {
            using var scope = ServiceProvider.CreateScope();
            var onlineService = scope.ServiceProvider.GetRequiredService<UserOnlineService>();
            await onlineService.CleanupStaleConnectionsAsync();
            Logger.LogDebug("Completed online status cleanup");
        }, cancellationToken);
    }
}