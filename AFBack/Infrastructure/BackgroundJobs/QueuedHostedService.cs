namespace AFBack.Infrastructure.BackgroundJobs;

public class QueuedHostedService(
    IBackgroundTaskQueue taskQueue,
    ILogger<QueuedHostedService> logger) : BackgroundService
{
    /// <summary>
    /// Kjører bakgrunnsjobene en etter en. Henter ut Tasks med DeuqeueAsync og kjører de
    /// </summary>
    /// <param name="ct"></param>
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        logger.LogInformation("Background task worker started");

        while (!ct.IsCancellationRequested)
        {
            try
            {
                var workItem = await taskQueue.DequeueAsync(ct);
                await workItem();               // kjør oppgaven
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Feil i bakgrunnsjobb");
            }
        }
    }
}
