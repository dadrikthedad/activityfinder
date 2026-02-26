namespace AFBack.Infrastructure.Cleanup;

/// <summary>
/// BackgroundService som orkestrerer alle ICleanupTask-implementasjoner.
/// Hver task kjøres på sitt eget intervall med sin egen InitialDelay.
/// </summary>
public class MaintenanceCleanupService(
    IServiceScopeFactory scopeFactory,
    ILogger<MaintenanceCleanupService> logger) : BackgroundService
{
    
    /// <summary>
    /// Henter alle registrerte ICleanupTask-typer ved oppstart og starter en uavhengig
    /// loop per task via RunTaskLoopAsync. Alle loops kjører parallelt via Task.WhenAll
    /// </summary>
    /// <param name="stoppingToken">Token som signaliserer at applikasjonen skal stoppe</param>
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Maintenance Cleanup Service started");

        // Hent alle task-typer ved oppstart
        using var initScope = scopeFactory.CreateScope();
        var taskTypes = initScope.ServiceProvider
            .GetServices<ICleanupTask>()
            .Select(t => t.GetType())
            .ToList();

        // Start en uavhengig loop per task
        var runners = taskTypes.Select(type => RunTaskLoopAsync(type, stoppingToken));
        await Task.WhenAll(runners);

        logger.LogInformation("Maintenance Cleanup Service stopped");
    }
    
    /// <summary>
    /// Kjører en enkelt ICleanupTask i en evig loop med sitt eget intervall.
    /// Venter først InitialDelay, deretter kjører ExecuteAsync etterfulgt av Interval-pause.
    /// Oppretter nytt DI-scope per iterasjon for å unngå lekkasje av scoped services.
    /// </summary>
    /// <param name="taskType">Type-referanse til ICleanupTask-implementasjonen som skal kjøres</param>
    /// <param name="stoppingToken">Token som signaliserer at applikasjonen skal stoppe</param>
    private async Task RunTaskLoopAsync(Type taskType, CancellationToken stoppingToken)
    {
        // Hent task-info for InitialDelay og Interval
        using (var scope = scopeFactory.CreateScope())
        {
            var task = scope.ServiceProvider
                .GetServices<ICleanupTask>()
                .First(t => t.GetType() == taskType);

            try
            {
                await Task.Delay(task.InitialDelay, stoppingToken);
            }
            catch (OperationCanceledException) { return; }
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            using var scope = scopeFactory.CreateScope();
            var task = scope.ServiceProvider
                .GetServices<ICleanupTask>()
                .First(t => t.GetType() == taskType);

            try
            {
                await task.ExecuteAsync(stoppingToken);
                logger.LogDebug("Cleanup task {TaskName} completed", task.TaskName);
            }
            catch (OperationCanceledException)
            {
                return;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Cleanup task {TaskName} failed", task.TaskName);
            }

            try
            {
                await Task.Delay(task.Interval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                return;
            }
        }
    }
}
