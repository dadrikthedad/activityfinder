using AFBack.Features.SyncEvents.DTOs;
using AFBack.Features.SyncEvents.Models;

namespace AFBack.Features.SyncEvents.Repository;

public interface ISyncEventRepository
{   
    /// <summary>
    /// Lagerer en eller flere syncevents innsendt som en liste
    /// </summary>
    /// <param name="syncEvents">Liste med SyncEvents for lagring</param>
    Task SaveSyncEventsAsync(List<SyncEvent> syncEvents);

    Task<int> CountEventsSinceTimestamp(string userId, DateTime lastSyncEvent);

    Task<List<SyncEventResponse>> GetSyncEventsAsync(string userId, DateTime lastSyncEvent);

    /// <summary>
    /// Sletter alle SyncEvents opprettet før angitt cutoff-dato.
    /// </summary>
    /// <param name="cutoff">Events eldre enn dette slettes</param>
    /// <param name="ct">CancellationToken</param>
    /// <returns>Antall slettede events</returns>
    Task<int> DeleteEventsOlderThanAsync(DateTime cutoff, CancellationToken ct = default);
}
