using AFBack.Features.SignalR.DTOs;

namespace AFBack.Features.SignalR.Services;

/// <summary>
/// Service for å håndtere SignalR connection lifecycle.
/// Abstraherer database-operasjoner bort fra hub.
/// </summary>
public interface IHubConnectionService
{
    /// <summary>
    /// Registrerer en ny WebSocket-tilkobling.
    /// </summary>
    /// <param name="metadata">Connection metadata fra klienten</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>ConnectionResult med collision info og andre aktive enheter</returns>
    Task<ConnectionResult> RegisterConnectionAsync(ConnectionMetadata metadata, CancellationToken ct = default);

    /// <summary>
    /// Fjerner en WebSocket-tilkobling.
    /// </summary>
    /// <param name="userId">Bruker-ID (string GUID)</param>
    /// <param name="deviceId">Device identifier</param>
    /// <param name="connectionId">SignalR connection ID</param>
    /// <param name="disconnectionReason">Årsak til disconnect</param>
    /// <param name="ct">Cancellation token</param>
    Task UnregisterConnectionAsync(string userId, string deviceId, string connectionId, 
        string? disconnectionReason = null, CancellationToken ct = default);

    /// <summary>
    /// Oppdaterer heartbeat-timestamp for en aktiv connection.
    /// Brukes av klienten for å signalisere at connectionen fortsatt er aktiv.
    /// StaleConnectionCleanupTask bruker dette for å rydde "stuck" connections.
    /// </summary>
    /// <param name="userId">Bruker-ID</param>
    /// <param name="connectionId">SignalR connection ID</param>
    /// <param name="ct">Cancellation token</param>
    Task UpdateHeartbeatAsync(string userId, string connectionId, CancellationToken ct = default);
    
}
