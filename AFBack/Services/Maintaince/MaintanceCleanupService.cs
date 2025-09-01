using AFBack.Interface;

public class MaintenanceCleanupService : BackgroundService
{
    private readonly IEnumerable<ICleanupTask> _cleanupTasks;
    private readonly ILogger<MaintenanceCleanupService> _logger;

    public MaintenanceCleanupService(
        IEnumerable<ICleanupTask> cleanupTasks,
        ILogger<MaintenanceCleanupService> logger)
    {
        _cleanupTasks = cleanupTasks;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var taskNames = string.Join(", ", _cleanupTasks.Select(t => t.TaskName));
        _logger.LogInformation("Maintenance Cleanup Service started with tasks: {TaskNames}", taskNames);

        var tasks = _cleanupTasks.Select(task => 
            Task.Run(() => task.ExecuteAsync(stoppingToken), stoppingToken)).ToArray();

        try
        {
            await Task.WhenAll(tasks);
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Maintenance Cleanup Service was cancelled");
        }

        _logger.LogInformation("Maintenance Cleanup Service stopped");
    }
}