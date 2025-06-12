namespace AFBack.Services;

using System.Threading.Channels;

public class BackgroundTaskQueue : IBackgroundTaskQueue
{
    private readonly Channel<Func<Task>> _queue;

    public BackgroundTaskQueue(int capacity = 1000)
    {
        // Bounded channel hindrer ubegrenset minnebruk ved ekstrem last.
        var options = new BoundedChannelOptions(capacity)
        {
            FullMode = BoundedChannelFullMode.Wait
        };
        _queue = Channel.CreateBounded<Func<Task>>(options);
    }

    public void QueueAsync(Func<Task> workItem)
    {
        if (workItem == null) throw new ArgumentNullException(nameof(workItem));
        if (!_queue.Writer.TryWrite(workItem))
            throw new InvalidOperationException("Task queue is full.");
    }

    public ValueTask<Func<Task>> DequeueAsync(CancellationToken token) =>
        _queue.Reader.ReadAsync(token);
}
