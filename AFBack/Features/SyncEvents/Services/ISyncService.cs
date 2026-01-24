using AFBack.Common.Results;
using AFBack.Features.SyncEvents.DTOs;
using AFBack.Features.SyncEvents.Enums;

namespace AFBack.Features.SyncEvents.Services;

public interface ISyncService
{
    /// <summary>
    /// Lager og lagrer en sync event for en eller flere bruker, sendt inn som en liste.
    /// EventData er data nødvendig for hver type event
    /// </summary>v
    /// <param name="targetUserIds">En liste med brukere som skal få syncevents</param>
    /// <param name="eventType">Event type, hentet fra SyncEventTypes</param>
    /// <param name="eventData">Dataen tilhørende eventet. Feks for ny melding: Samtalen og meldingen</param>
    /// <exception cref="ArgumentException">Hvis targetUserIds er tom</exception>
    Task CreateSyncEventsAsync(List<string> targetUserIds, SyncEventType eventType, object eventData);

    Task<Result<SyncResponse>> ValidateSyncForDeviceAsync(string userId, int userDeviceId);
    
    Task CleanupOldEventsAsync();
    
}
