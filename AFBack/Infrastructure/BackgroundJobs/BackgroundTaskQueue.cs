using System.Threading.Channels;
using AFBack.Configurations.Options;
using AFBack.Services;

namespace AFBack.Infrastructure.BackgroundJobs;

/// <summary>
/// Ved oppstart så opprettes en Channel med en satt kapasitetsgrense
/// </summary>
public class BackgroundTaskQueue : IBackgroundTaskQueue
{
    // Channel fungerer som en Producer-Consumer-kanal
    private readonly Channel<Func<Task>> _queue;
    
    // Konstruktøren opprettes ved oppstart av applikasjon
    public BackgroundTaskQueue(int capacity = ConfigureBackgroundTaskQueue.MaxCapacity)
    {
        // Bounded channel hindrer ubegrenset minnebruk ved ekstrem last
        // Produceren vil da vente istedenfor å burke opp alt minne
        var options = new BoundedChannelOptions(capacity)
        {
            FullMode = BoundedChannelFullMode.Wait
        };
        _queue = Channel.CreateBounded<Func<Task>>(options);
    }  
    
    /// <inheritdoc />
    public async ValueTask QueueAsync(Func<Task> workItem, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(workItem);
        await _queue.Writer.WriteAsync(workItem, ct);
    }

    /// <inheritdoc />
    public bool TryQueue(Func<Task> workItem)
    {
        ArgumentNullException.ThrowIfNull(workItem);
        return _queue.Writer.TryWrite(workItem);
    }

    /// <inheritdoc />
    public ValueTask<Func<Task>> DequeueAsync(CancellationToken ct) =>
        _queue.Reader.ReadAsync(ct);
}
