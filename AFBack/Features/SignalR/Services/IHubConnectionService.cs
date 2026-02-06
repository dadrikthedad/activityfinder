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
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>ConnectionResult med collision info og andre aktive enheter</returns>
    Task<ConnectionResult> RegisterConnectionAsync(
        ConnectionMetadata metadata, 
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Fjerner en WebSocket-tilkobling.
    /// </summary>
    /// <param name="userId">Bruker-ID (string GUID)</param>
    /// <param name="deviceId">Device identifier</param>
    /// <param name="connectionId">SignalR connection ID</param>
    /// <param name="disconnectionReason">Årsak til disconnect</param>
    /// <param name="cancellationToken">Cancellation token</param>
    Task UnregisterConnectionAsync(
        string userId, 
        string deviceId, 
        string connectionId, 
        string? disconnectionReason = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Henter aktive connection IDs for en bruker (alle enheter).
    /// </summary>
    /// <param name="userId">Bruker-ID (string GUID)</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Liste med aktive connection IDs</returns>
    Task<IReadOnlyList<string>> GetActiveConnectionsForUserAsync(
        string userId, 
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Henter aktive connection IDs for flere brukere.
    /// </summary>
    /// <param name="userIds">Liste med bruker-IDer</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Dictionary med userId -> liste av connection IDs</returns>
    Task<IReadOnlyDictionary<string, IReadOnlyList<string>>> GetActiveConnectionsForUsersAsync(
        IEnumerable<string> userIds, 
        CancellationToken cancellationToken = default);
}
