namespace AFBack.Features.SignalR.Services;

/// <summary>
/// Service for å sende SignalR-meldinger til klienter.
/// </summary>
public interface ISignalRNotificationService
{
    /// <summary>
    /// Sender SignalR-melding til en spesifikk bruker (alle enheter).
    /// </summary>
    /// <param name="userId">Bruker-ID</param>
    /// <param name="eventName">Event-navn (bruk HubConstants.ClientEvents)</param>
    /// <param name="payload">Data som sendes til klienten</param>
    /// <param name="context">Kontekst for logging ved feil</param>
    Task SendToUserAsync(string userId, string eventName, object payload, string context);

    /// <summary>
    /// Sender SignalR-melding til flere brukere.
    /// </summary>
    /// <param name="userIds">Liste med bruker-IDer</param>
    /// <param name="eventName">Event-navn (bruk HubConstants.ClientEvents)</param>
    /// <param name="payload">Data som sendes til klientene</param>
    /// <param name="context">Kontekst for logging ved feil</param>
    Task SendToUsersAsync(IEnumerable<string> userIds, string eventName, object payload, string context);
}
