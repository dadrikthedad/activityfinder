namespace AFBack.Services
{
    public class MaintenanceCleanupService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<MaintenanceCleanupService> _logger;

        public MaintenanceCleanupService(
            IServiceProvider serviceProvider, 
            ILogger<MaintenanceCleanupService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Maintenance Cleanup Service started");

            // Start begge cleanup tasks parallelt
            var onlineCleanupTask = RunOnlineStatusCleanup(stoppingToken);
            var syncCleanupTask = RunSyncEventsCleanup(stoppingToken);

            await Task.WhenAll(onlineCleanupTask, syncCleanupTask);

            _logger.LogInformation("Maintenance Cleanup Service stopped");
        }

        private async Task RunOnlineStatusCleanup(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var scope = _serviceProvider.CreateScope();
                    var onlineService = scope.ServiceProvider.GetRequiredService<UserOnlineService>();
                    
                    await onlineService.CleanupStaleConnectionsAsync();
                    
                    // Run cleanup every 2 minutes
                    await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error during online status cleanup");
                    await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
                }
            }
        }

        private async Task RunSyncEventsCleanup(CancellationToken stoppingToken)
        {
            // Start med en liten delay så den ikke kjører med en gang
            await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
    
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var scope = _serviceProvider.CreateScope();
                    var syncService = scope.ServiceProvider.GetRequiredService<SyncService>();
            
                    await syncService.CleanupOldEventsAsync();
            
                    // Run sync cleanup every 24 hours
                    await Task.Delay(TimeSpan.FromHours(24), stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error during sync events cleanup");
                    // Retry after 1 hour on error
                    await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
                }
            }
        }
    }
}