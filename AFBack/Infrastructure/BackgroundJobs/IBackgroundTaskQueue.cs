namespace AFBack.Infrastructure.BackgroundJobs;

public interface IBackgroundTaskQueue
{
    /// <summary>
    /// Legger et arbeid i køen. Venter asynkront hvis køen er full.
    /// Bruk for kritiske oppgaver som må kjøres.
    /// </summary>
    /// <param name="workItem">Task-objektet som skal utføres</param>
    /// <param name="ct"></param>
    ValueTask QueueAsync(Func<Task> workItem, CancellationToken ct = default);

    /// <summary>
    /// Prøver å legge et arbeid i køen uten å vente.
    /// Bruk for ikke-kritiske oppgaver som e-poster der brukeren ikke skal blokkeres.
    /// </summary>
    /// <param name="workItem">Task-objektet som skal utføres</param>
    /// <returns>Bool med true hvis den havnet i køen, eller false hvis ikke</returns>
    bool TryQueue(Func<Task> workItem);

    /// <summary>
    /// Hent neste arbeid når det er klart
    /// </summary>
    /// <param name="ct"></param>
    ValueTask<Func<Task>> DequeueAsync(CancellationToken ct);
}
