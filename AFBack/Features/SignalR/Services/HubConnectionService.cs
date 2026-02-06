using AFBack.Data;
using AFBack.Features.Auth.Models;
using AFBack.Features.SignalR.DTOs;
using AFBack.Features.SignalR.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.SignalR.Services;

/// <summary>
/// Håndterer SignalR connection lifecycle og database-operasjoner.
/// Separert fra hub for bedre testbarhet og separation of concerns.
/// </summary>
public sealed class HubConnectionService(
    AppDbContext context,
    ILogger<HubConnectionService> logger)
    : IHubConnectionService
{
    /// <inheritdoc />
    public async Task<ConnectionResult> RegisterConnectionAsync(
        ConnectionMetadata metadata,
        CancellationToken cancellationToken = default)
    {
        try
        {
            // Finn UserDevice basert på DeviceFingerprint (deviceId fra klient)
            var userDevice = await context.Set<UserDevice>()
                .FirstOrDefaultAsync(
                    d => d.UserId == metadata.UserId && d.DeviceFingerprint == metadata.DeviceId,
                    cancellationToken);

            if (userDevice == null)
            {
                logger.LogWarning(
                    "Device not found for user {UserId}, fingerprint {DeviceId}",
                    metadata.UserId, metadata.DeviceId);
                return ConnectionResult.Failed("Device not registered");
            }

            // Sjekk for eksisterende aktiv connection på samme device
            var existingConnection = await context.UserOnlineStatuses
                .FirstOrDefaultAsync(
                    c => c.UserId == metadata.UserId 
                         && c.UserDeviceId == userDevice.Id 
                         && c.IsConnected,
                    cancellationToken);

            var hasCollision = false;
            string? previousConnectionId = null;

            if (existingConnection != null && existingConnection.ConnectionId != metadata.ConnectionId)
            {
                hasCollision = true;
                previousConnectionId = existingConnection.ConnectionId;
                
                // Marker gammel connection som disconnected
                existingConnection.IsConnected = false;
                existingConnection.DisconnectedAt = DateTime.UtcNow;
                existingConnection.DisconnectionReason = "Replaced by new connection";
                
                logger.LogInformation(
                    "Device collision for user {UserId}, device {DeviceId}. Previous: {PreviousConnectionId}",
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
                ReconnectionAttempts = 0
            };

            context.UserOnlineStatuses.Add(newConnection);

            // Oppdater device LastUsedAt
            userDevice.LastUsedAt = DateTime.UtcNow;

            // Hent andre aktive connections for denne brukeren (på andre enheter)
            var otherActiveConnections = await context.UserOnlineStatuses
                .Where(c => c.UserId == metadata.UserId
                            && c.UserDeviceId != userDevice.Id
                            && c.IsConnected)
                .Select(c => c.ConnectionId)
                .ToListAsync(cancellationToken);

            await context.SaveChangesAsync(cancellationToken);

            logger.LogInformation(
                "WebSocket connected: User {UserId}, Device {DeviceId}, Connection {ConnectionId}",
                metadata.UserId, metadata.DeviceId, metadata.ConnectionId);

            return ConnectionResult.Successful(
                hasCollision,
                previousConnectionId,
                otherActiveConnections);
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
    public async Task UnregisterConnectionAsync(
        string userId,
        string deviceId,
        string connectionId,
        string? disconnectionReason = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var connection = await context.UserOnlineStatuses
                .FirstOrDefaultAsync(
                    c => c.UserId == userId && c.ConnectionId == connectionId,
                    cancellationToken);

            if (connection == null)
            {
                logger.LogWarning(
                    "Connection not found for unregister: User {UserId}, Connection {ConnectionId}",
                    userId, connectionId);
                return;
            }

            connection.IsConnected = false;
            connection.DisconnectedAt = DateTime.UtcNow;
            connection.DisconnectionReason = disconnectionReason;

            await context.SaveChangesAsync(cancellationToken);

            logger.LogInformation(
                "WebSocket disconnected: User {UserId}, Connection {ConnectionId}, Reason: {Reason}",
                userId, connectionId, disconnectionReason ?? "Normal");
        }
        catch (Exception ex)
        {
            logger.LogError(ex,
                "Failed to unregister connection for user {UserId}",
                userId);
        }
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<string>> GetActiveConnectionsForUserAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        return await context.UserOnlineStatuses
            .Where(c => c.UserId == userId && c.IsConnected)
            .Select(c => c.ConnectionId)
            .ToListAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task<IReadOnlyDictionary<string, IReadOnlyList<string>>> GetActiveConnectionsForUsersAsync(
        IEnumerable<string> userIds,
        CancellationToken cancellationToken = default)
    {
        var userIdList = userIds.ToList();
        
        var connections = await context.UserOnlineStatuses
            .Where(c => userIdList.Contains(c.UserId) && c.IsConnected)
            .Select(c => new { c.UserId, c.ConnectionId })
            .ToListAsync(cancellationToken);

        return connections
            .GroupBy(c => c.UserId)
            .ToDictionary(
                g => g.Key,
                g => (IReadOnlyList<string>)g.Select(c => c.ConnectionId).ToList());
    }
}
