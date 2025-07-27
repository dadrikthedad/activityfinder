
namespace AFBack.Services
{
    public class OnlineStatusCleanupService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<OnlineStatusCleanupService> _logger;

        public OnlineStatusCleanupService(
            IServiceProvider serviceProvider, 
            ILogger<OnlineStatusCleanupService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Online Status Cleanup Service started");

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
                    // Expected when cancellation is requested
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error during online status cleanup");
                    // Wait 1 minute before retrying on error
                    await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
                }
            }

            _logger.LogInformation("Online Status Cleanup Service stopped");
        }
    }
}