namespace AFBack.Features.Broadcast.Services;

public interface IProfileBroadcastService
{
    /// <summary>
    /// Broadcaster profilendring til alle relevante brukere.
    /// Refresher UserSummaryCache, finner venner + samtalepartnere (Accepted og Pending),
    /// sender SignalR + SyncEvent til alle berørte, og SyncEvent til brukerens egne andre enheter.
    /// </summary>
    /// <param name="userId">Brukeren som endret profilen</param>
    /// <param name="fullName">Oppdatert fullt navn</param>
    /// <param name="profileImageUrl">Oppdatert profilbilde-URL</param>
    Task BroadcastProfileUpdatedAsync(string userId, string fullName, string? profileImageUrl);
}
