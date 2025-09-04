using AFBack.Interface;


public class MaintenanceCleanupService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<MaintenanceCleanupService> _logger;

    public MaintenanceCleanupService(
        IServiceScopeFactory scopeFactory,
        ILogger<MaintenanceCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Maintenance Cleanup Service started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var cleanupTasks = scope.ServiceProvider.GetServices<ICleanupTask>();
                
                var taskNames = string.Join(", ", cleanupTasks.Select(t => t.TaskName));
                _logger.LogInformation("Running cleanup tasks: {TaskNames}", taskNames);

                var tasks = cleanupTasks.Select(task => 
                    task.ExecuteAsync(stoppingToken)).ToArray();

                await Task.WhenAll(tasks);
                
                _logger.LogInformation("All cleanup tasks completed successfully");
            }
            catch (OperationCanceledException)
            {
                _logger.LogInformation("Maintenance Cleanup Service was cancelled");
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred during cleanup tasks execution");
            }

            // Wait 24 hours before next execution
            try
            {
                await Task.Delay(TimeSpan.FromHours(24), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                _logger.LogInformation("Maintenance Cleanup Service was cancelled during delay");
                break;
            }
        }

        _logger.LogInformation("Maintenance Cleanup Service stopped");
    }
}