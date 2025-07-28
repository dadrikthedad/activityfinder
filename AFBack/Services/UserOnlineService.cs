using System.Text.Json;
using AFBack.Data;
using AFBack.DTOs;
using AFBack.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Services;

public class UserOnlineService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<UserOnlineService> _logger;

    public UserOnlineService(ApplicationDbContext context, ILogger<UserOnlineService> logger)
    {
        _context = context;
        _logger = logger;
    }
    
    // Heartbeat

    public async Task<(bool success, string errorMessage)> MarkUserOnlineAsync(int userId, OnlineStatusRequest request)
    {
        try
        {
            var existingStatus = await _context.UserOnlineStatuses
                .FirstOrDefaultAsync(u => u.UserId == userId && u.DeviceId == request.DeviceId);

            var lastBootstrapDateTime = request.LastBootstrapAt.HasValue 
                ? DateTimeOffset.FromUnixTimeMilliseconds(request.LastBootstrapAt.Value).UtcDateTime
                : (DateTime?)null;

            if (existingStatus != null)
            {
                // Oppdater eksisterende record
                existingStatus.LastSeen = DateTime.UtcNow;
                existingStatus.LastBootstrapAt = lastBootstrapDateTime;
                existingStatus.Platform = request.Platform;
                existingStatus.IsOnline = true;
                existingStatus.Capabilities = request.Capabilities ?? Array.Empty<string>();
            }
            else
            {
                // Opprett ny record
                var newStatus = new UserOnlineStatus
                {
                    UserId = userId,
                    DeviceId = request.DeviceId,
                    LastSeen = DateTime.UtcNow,
                    LastBootstrapAt = lastBootstrapDateTime,
                    Platform = request.Platform,
                    IsOnline = true,
                    Capabilities = request.Capabilities ?? Array.Empty<string>()
                };

                _context.UserOnlineStatuses.Add(newStatus);
            }

            await _context.SaveChangesAsync();
            return (true, null);
        }
        catch (Microsoft.EntityFrameworkCore.DbUpdateException dbEx)
        {
            // Hvis det fortsatt er en duplicate key error til tross for vår check
            if (dbEx.InnerException is Npgsql.PostgresException pgEx && pgEx.SqlState == "23505")
            {
                // Race condition - prøv å oppdatere i stedet
                try
                {
                    var existingStatus = await _context.UserOnlineStatuses
                        .FirstOrDefaultAsync(u => u.UserId == userId && u.DeviceId == request.DeviceId);
                    
                    if (existingStatus != null)
                    {
                        existingStatus.LastSeen = DateTime.UtcNow;
                        existingStatus.LastBootstrapAt = request.LastBootstrapAt.HasValue 
                            ? DateTimeOffset.FromUnixTimeMilliseconds(request.LastBootstrapAt.Value).UtcDateTime
                            : (DateTime?)null;
                        existingStatus.Platform = request.Platform;
                        existingStatus.IsOnline = true;
                        existingStatus.Capabilities = request.Capabilities ?? Array.Empty<string>();
                        
                        await _context.SaveChangesAsync();
                        return (true, null);
                    }
                }
                catch
                {
                    // Hvis retry feiler, returner feil
                }
            }

            // Andre database feil
            var innerException = dbEx.InnerException;
            var innerType = innerException?.GetType().Name ?? "No inner exception";
            var innerMessage = innerException?.Message ?? "No inner message";
            
            if (dbEx.InnerException is Npgsql.PostgresException pgEx2)
            {
                var errorMessage = pgEx2.SqlState switch
                {
                    "23505" => $"Duplicate entry: {pgEx2.Detail ?? pgEx2.MessageText}",
                    "23503" => $"Foreign key violation: {pgEx2.Detail ?? pgEx2.MessageText}", 
                    "23502" => $"Required field missing: {pgEx2.Detail ?? pgEx2.MessageText}",
                    "22001" => $"Data too long: {pgEx2.Detail ?? pgEx2.MessageText}",
                    "08006" => "Database connection failed",
                    _ => $"PostgreSQL error ({pgEx2.SqlState}): {pgEx2.MessageText}"
                };
                return (false, errorMessage);
            }
            else
            {
                return (false, $"Database error - Type: {innerType}, Message: {innerMessage}");
            }
        }
        catch (Exception ex)
        {
            return (false, $"Unexpected error: {ex.Message}");
        }
    }
    
    public async Task<bool> MarkUserOfflineAsync(int userId, string deviceId)
    {
        try
        {
            var status = await _context.UserOnlineStatuses
                .FirstOrDefaultAsync(u => u.UserId == userId && u.DeviceId == deviceId);

            if (status != null)
            {
                status.IsOnline = false;
                status.LastSeen = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                
                _logger.LogInformation("User {UserId} marked as offline on device {DeviceId}", 
                    userId, deviceId);
            }
            else
            {
                _logger.LogWarning("Attempted to mark user {UserId} offline on device {DeviceId}, but no online status found", 
                    userId, deviceId);
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to mark user {UserId} as offline on device {DeviceId}", 
                userId, deviceId);
            return false;
        }
    }

    public async Task UpdateHeartbeatAsync(int userId, string deviceId)
    {
        try
        {
            var status = await _context.UserOnlineStatuses
                .FirstOrDefaultAsync(u => u.UserId == userId && u.DeviceId == deviceId);

            if (status != null)
            {
                status.LastSeen = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                
                _logger.LogDebug("Updated heartbeat for User {UserId} on device {DeviceId}", 
                    userId, deviceId);
            }
            else
            {
                _logger.LogWarning("Heartbeat update failed: No online status found for User {UserId} on device {DeviceId}", 
                    userId, deviceId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update heartbeat for user {UserId} on device {DeviceId}", 
                userId, deviceId);
        }
    }
    
    /////////////////////////////// ------------------ WebSocket ------------------------------------------ ////////////////////////
    
     /// <summary>
    /// Registrer WebSocket som tilkoblet for spesifikk enhet
    /// </summary>
    public async Task SetWebSocketConnectedAsync(int userId, string deviceId, string connectionId, string platform = "web", string[] capabilities = null, object metadata = null)
    {
        try
        {
            var existingStatus = await _context.UserOnlineStatuses
                .FirstOrDefaultAsync(s => s.UserId == userId && s.DeviceId == deviceId);

            var now = DateTime.UtcNow;
            var metadataJson = metadata != null ? JsonSerializer.Serialize(metadata) : null;

            if (existingStatus != null)
            {
                // Oppdater eksisterende status
                existingStatus.IsWebSocketConnected = true;
                existingStatus.ConnectionId = connectionId;
                existingStatus.WebSocketConnectedAt = now;
                existingStatus.WebSocketDisconnectedAt = null;
                existingStatus.DisconnectionReason = null;
                existingStatus.Platform = platform;
                existingStatus.Capabilities = capabilities ?? Array.Empty<string>();
                existingStatus.ConnectionMetadata = metadataJson;
                existingStatus.ReconnectionAttempts = 0;
            }
            else
            {
                // Opprett ny status for denne enheten
                var newStatus = new UserOnlineStatus
                {
                    UserId = userId,
                    DeviceId = deviceId,
                    ConnectionId = connectionId,
                    IsOnline = false, // La heartbeat-systemet håndtere IsOnline
                    IsWebSocketConnected = true,
                    WebSocketConnectedAt = now,
                    LastSeen = now,
                    Platform = platform,
                    Capabilities = capabilities ?? Array.Empty<string>(),
                    ConnectionMetadata = metadataJson,
                    ReconnectionAttempts = 0
                };
                
                _context.UserOnlineStatuses.Add(newStatus);
            }

            await _context.SaveChangesAsync();
            _logger.LogInformation("✅ WebSocket connected: User {UserId}, Device {DeviceId}, Connection {ConnectionId}", 
                userId, deviceId, connectionId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Failed to set WebSocket connected for user {UserId}, device {DeviceId}", userId, deviceId);
        }
    }
     
    // <summary>
    /// Registrer WebSocket som frakoblet for spesifikk enhet
    /// </summary>
    public async Task SetWebSocketDisconnectedAsync(int userId, string deviceId, string connectionId, string reason = null)
    {
        try
        {
            var status = await _context.UserOnlineStatuses
                .FirstOrDefaultAsync(s => s.UserId == userId && s.DeviceId == deviceId && s.ConnectionId == connectionId);

            if (status != null)
            {
                var now = DateTime.UtcNow;
                
                status.IsWebSocketConnected = false;
                status.WebSocketDisconnectedAt = now;
                status.DisconnectionReason = reason;
                status.ConnectionId = null; // Clear connection ID
                
                await _context.SaveChangesAsync();
                _logger.LogInformation("🔌 WebSocket disconnected: User {UserId}, Device {DeviceId}, Reason: {Reason}", 
                    userId, deviceId, reason ?? "Unknown");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Failed to set WebSocket disconnected for user {UserId}, device {DeviceId}", userId, deviceId);
        }
    }
    
    /// <summary>
    /// Rydd opp /////////////////////////////////////////
    /// </summary>

    public async Task CleanupStaleConnectionsAsync()
    {
        try
        {
            var staleThreshold = DateTime.UtcNow.AddMinutes(-5); // Mark as offline after 5 minutes

            var staleConnections = await _context.UserOnlineStatuses
                .Where(u => u.IsOnline && u.LastSeen < staleThreshold)
                .ToListAsync();

            foreach (var connection in staleConnections)
            {
                connection.IsOnline = false;
                _logger.LogDebug("Marking stale connection offline: User {UserId} on device {DeviceId} (Last seen: {LastSeen})", 
                    connection.UserId, connection.DeviceId, connection.LastSeen);
            }

            if (staleConnections.Any())
            {
                await _context.SaveChangesAsync();
                _logger.LogInformation("Cleaned up {Count} stale connections", staleConnections.Count);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to cleanup stale connections");
        }
    }
}