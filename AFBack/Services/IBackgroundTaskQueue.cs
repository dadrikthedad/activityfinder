namespace AFBack.Services;

public interface IBackgroundTaskQueue
{
    /// <summary>Legg et asynkront arbeid i køen.</summary>
    void QueueAsync(Func<Task> workItem);

    /// <summary>Hent neste arbeid når det er klart.</summary>
    ValueTask<Func<Task>> DequeueAsync(CancellationToken token);
}