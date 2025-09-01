using AFBack.Interface;

namespace AFBack.Services.Maintenance;

public abstract class CleanupTaskBase : ICleanupTask
{
    protected readonly IServiceProvider ServiceProvider;
    protected readonly ILogger Logger;

    public abstract string TaskName { get; }
    public abstract TimeSpan Interval { get; }
    public virtual TimeSpan InitialDelay => TimeSpan.Zero;

    protected CleanupTaskBase(IServiceProvider serviceProvider, ILogger logger)
    {
        ServiceProvider = serviceProvider;
        Logger = logger;
    }

    public abstract Task ExecuteAsync(CancellationToken cancellationToken);

    protected async Task RunWithErrorHandlingAsync(
        Func<Task> action, 
        CancellationToken cancellationToken)
    {
        if (InitialDelay > TimeSpan.Zero)
        {
            await Task.Delay(InitialDelay, cancellationToken);
        }

        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                await action();
                await Task.Delay(Interval, cancellationToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error during {TaskName} cleanup", TaskName);
                await Task.Delay(TimeSpan.FromMinutes(5), cancellationToken);
            }
        }
    }
}