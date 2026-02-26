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
    
    /// <summary>
    /// Sjekker og henter om det er nødvendig med full bootstrap eller henting av synceventer
    /// </summary>
    /// <param name="userId">Brukeren vi skal hente sync events for</param>
    /// <param name="userDeviceId">Brukerens enhet</param>
    /// <returns>SyncResponse</returns>
    Task<Result<SyncResponse>> ValidateSyncForDeviceAsync(string userId, int userDeviceId);
    
    /// <summary>
    /// Sletter SyncEvents eldre enn InactivityThreshold.
    /// Enheter som har vært inaktive lenger enn dette trigges til full bootstrap uansett,
    /// så gamle events er ikke lenger nødvendige.
    /// </summary>
    Task CleanupOldEventsAsync(CancellationToken ct = default);
    
}
