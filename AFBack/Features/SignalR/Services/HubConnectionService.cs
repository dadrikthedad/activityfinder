using AFBack.Features.Auth.Repositories;
using AFBack.Features.SignalR.DTOs;
using AFBack.Features.SignalR.Models;
using AFBack.Features.SignalR.Repository;

namespace AFBack.Features.SignalR.Services;

/// <summary>
/// Håndterer SignalR connection lifecycle og database-operasjoner.
/// Separert fra hub for bedre testbarhet og separation of concerns.
/// </summary>
public sealed class HubConnectionService(
    IUserConnectionRepository connectionRepository,
    IUserDeviceRepository deviceRepository,
    ILogger<HubConnectionService> logger) : IHubConnectionService
{
    // ============================== GET ==============================
    
    /// <inheritdoc />
    public async Task<ConnectionResult> RegisterConnectionAsync(ConnectionMetadata metadata, 
        CancellationToken ct = default)
    {
        try
        {
            // Henter UserDevice
            var userDevice = await deviceRepository.GetByFingerprintAsync(metadata.UserId, 
                metadata.DeviceId);
            
            // Ingen UserDevice - systemfeil
            if (userDevice == null)
            {
                logger.LogWarning("Device not found for user {UserId}, fingerprint {DeviceId}",
                    metadata.UserId, metadata.DeviceId);
                return ConnectionResult.Failed("Device not registered");
            }

            // Sjekk for eksisterende aktiv connection på samme device
            var existingConnection = await connectionRepository.GetActiveByDeviceAsync(
                metadata.UserId, userDevice.Id, ct);
            
            // Variabelen for å sjekke om connection eksisterer, men ikke har blitt disconnected ordentlig
            // Feks ved reconnects
            var hasPreviousConnection  = false;
            string? previousConnectionId = null;
            
            // Fjerner den gamle connection
            if (existingConnection != null && existingConnection.ConnectionId != metadata.ConnectionId)
            {
                hasPreviousConnection = true;
                previousConnectionId = existingConnection.ConnectionId;

                // Slett gammel connection — ingen grunn til å beholde historikk
                await connectionRepository.DeleteAsync(existingConnection, ct);

                logger.LogInformation("Device collision for user {UserId}, device {DeviceId}." +
                                      " Previous: {PreviousConnectionId}",
                    metadata.UserId, metadata.DeviceId, previousConnectionId);
            }

            // Opprett ny connection
            var newConnection = new UserConnection
            {
                UserId = metadata.UserId,
                UserDeviceId = userDevice.Id,
                ConnectionId = metadata.ConnectionId,
                IsConnected = true,
                ConnectedAt = DateTime.UtcNow,
                LastHeartbeat = DateTime.UtcNow,
            };

            // Oppdater device LastUsedAt
            userDevice.LastUsedAt = DateTime.UtcNow;

            // Hent andre aktive connections før vi lagrer (unngå å inkludere den nye)
            var otherActiveConnections = await connectionRepository.GetOtherActiveConnectionIdsAsync(
                metadata.UserId, userDevice.Id, ct);

            await connectionRepository.AddAsync(newConnection, ct);

            logger.LogInformation("WebSocket connected: User {UserId}, Device {DeviceId}, Connection {ConnectionId}",
                metadata.UserId, metadata.DeviceId, metadata.ConnectionId);

            return ConnectionResult.Successful(hasPreviousConnection , previousConnectionId, otherActiveConnections);
        }
        catch (Exception ex)
        {
            logger.LogError(ex,
                "Failed to register connection for user {UserId}, device {DeviceId}",
                metadata.UserId, metadata.DeviceId);

            return ConnectionResult.Failed(ex.Message);
        }
    }

    /// <inheritdoc />
    public async Task UnregisterConnectionAsync(string userId, string deviceId, string connectionId,
        string? disconnectionReason = null, CancellationToken ct = default)
    {
        try
        {
            var connection = await connectionRepository.GetByConnectionIdAsync(userId, connectionId, ct);

            if (connection == null)
            {
                logger.LogWarning("Connection not found for unregister: User {UserId}, Connection {ConnectionId}",
                    userId, connectionId);
                return;
            }

            await connectionRepository.DeleteAsync(connection, ct);

            logger.LogInformation("WebSocket disconnected: User {UserId}, Connection {ConnectionId}, Reason: {Reason}",
                userId, connectionId, disconnectionReason ?? "Normal");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to unregister connection for user {UserId}", userId);
        }
    }

    /// <inheritdoc />
    public async Task UpdateHeartbeatAsync(string userId, string connectionId, CancellationToken ct = default)
    {
        try
        {
            var updated = await connectionRepository.UpdateHeartbeatAsync(userId, connectionId, ct);

            if (updated == 0)
                logger.LogDebug("Heartbeat skipped - no active connection found: User {UserId}, " +
                                "Connection {ConnectionId}", userId, connectionId);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to update heartbeat for user {UserId}, connection {ConnectionId}",
                userId, connectionId);
        }
    }

    
}
