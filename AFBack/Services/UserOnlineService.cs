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

    public async Task<(bool success, string errorMessage)> MarkUserOnlineAsync(int userId, OnlineStatusRequest request)
    {
        try
        {
            var existingStatus = await _context.UserOnlineStatuses
                .FirstOrDefaultAsync(u => u.UserId == userId && u.DeviceId == request.DeviceId);

            if (existingStatus != null)
            {
                existingStatus.LastSeen = DateTime.UtcNow;
                existingStatus.LastBootstrapAt = request.LastBootstrapAt.HasValue 
                    ? DateTimeOffset.FromUnixTimeMilliseconds(request.LastBootstrapAt.Value).DateTime
                    : null;
                existingStatus.Platform = request.Platform;
                existingStatus.IsOnline = true;
                existingStatus.Capabilities = request.Capabilities;
            }
            else
            {
                var lastBootstrapDateTime = request.LastBootstrapAt.HasValue 
                    ? DateTimeOffset.FromUnixTimeMilliseconds(request.LastBootstrapAt.Value).UtcDateTime
                    : (DateTime?)null;

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
            string errorMessage = "Database update failed - constraint violation or connection issue";
            
            if (dbEx.InnerException is Npgsql.PostgresException pgEx)
            {
                errorMessage = pgEx.SqlState switch
                {
                    "23505" => "Device is already registered for this user",
                    "23503" => "Invalid user reference - user may not exist", 
                    "23502" => "Required field is missing",
                    "22001" => "Data too long for database field",
                    "08006" => "Database connection failed",
                    _ => $"Database constraint error: {pgEx.MessageText}"
                };
            }
            
            return (false, errorMessage);
        }
        catch (Exception ex)
        {
            return (false, "Unexpected error occurred while updating online status");
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

    public async Task<UserOnlineStatus?> GetUserOnlineStatusAsync(int userId, string? deviceId = null)
    {
        try
        {
            var query = _context.UserOnlineStatuses
                .Where(u => u.UserId == userId && u.IsOnline);

            if (!string.IsNullOrEmpty(deviceId))
            {
                query = query.Where(u => u.DeviceId == deviceId);
            }

            return await query
                .OrderByDescending(u => u.LastSeen)
                .FirstOrDefaultAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get online status for user {UserId}", userId);
            return null;
        }
    }

    public async Task<List<UserOnlineStatus>> GetOnlineUsersAsync(List<int> userIds)
    {
        try
        {
            return await _context.UserOnlineStatuses
                .Where(u => userIds.Contains(u.UserId) && u.IsOnline)
                .GroupBy(u => u.UserId)
                .Select(g => g.OrderByDescending(u => u.LastSeen).First())
                .ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get online users for {Count} user IDs", userIds.Count);
            return new List<UserOnlineStatus>();
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

    // 🔧 NYTT: Hjelpemetode for å sjekke om bruker er online
    public async Task<bool> IsUserOnlineAsync(int userId)
    {
        try
        {
            return await _context.UserOnlineStatuses
                .AnyAsync(u => u.UserId == userId && u.IsOnline);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to check if user {UserId} is online", userId);
            return false;
        }
    }

    // 🔧 NYTT: Hent alle online enheter for en bruker
    public async Task<List<UserOnlineStatus>> GetUserDevicesAsync(int userId)
    {
        try
        {
            return await _context.UserOnlineStatuses
                .Where(u => u.UserId == userId && u.IsOnline)
                .OrderByDescending(u => u.LastSeen)
                .ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get devices for user {UserId}", userId);
            return new List<UserOnlineStatus>();
        }
    }
}