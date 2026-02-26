using AFBack.Data;
using AFBack.Features.SignalR.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.SignalR.Repository;

public class UserConnectionRepository(AppDbContext context) : IUserConnectionRepository
{
    // ============================== GET ==============================
    
    /// <inheritdoc />
    public async Task<UserConnection?> GetByConnectionIdAsync(
        string userId, string connectionId, CancellationToken ct = default) =>
        await context.UserOnlineStatuses
            .FirstOrDefaultAsync(c => c.UserId == userId 
                                      && c.ConnectionId == connectionId, ct);

    
    /// <inheritdoc />
    public async Task<IReadOnlyList<string>> GetActiveConnectionIdsAsync(string userId, CancellationToken ct = default) 
        => await context.UserOnlineStatuses
            .Where(c => c.UserId == userId && c.IsConnected)
            .Select(c => c.ConnectionId)
            .ToListAsync(ct);
    
    
    /// <inheritdoc />
    public async Task<UserConnection?> GetActiveByDeviceAsync(string userId, int userDeviceId, 
        CancellationToken ct = default) => await context.UserOnlineStatuses
            .FirstOrDefaultAsync(
                c => c.UserId == userId 
                     && c.UserDeviceId == userDeviceId && c.IsConnected, ct);

    
    /// <inheritdoc />
    public async Task<List<string>> GetOtherActiveConnectionIdsAsync(
        string userId, int excludeDeviceId, CancellationToken ct = default) =>
        await context.UserOnlineStatuses
            .Where(c => c.UserId == userId
                        && c.UserDeviceId != excludeDeviceId
                        && c.IsConnected)
            .Select(c => c.ConnectionId)
            .ToListAsync(ct);

    

    /// <inheritdoc />
    public async Task AddAsync(UserConnection connection, CancellationToken ct = default)
    {
        context.UserOnlineStatuses.Add(connection);
        await context.SaveChangesAsync(ct);
    }

    
    // ============================== UPDATE ==============================

    /// <inheritdoc />
    public async Task<int> UpdateHeartbeatAsync(
        string userId, string connectionId, CancellationToken ct = default) =>
        await context.UserOnlineStatuses
            .Where(c => c.UserId == userId 
                        && c.ConnectionId == connectionId && c.IsConnected)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(c => c.LastHeartbeat, DateTime.UtcNow), ct);
    
    
    /// <inheritdoc />
    public async Task DeleteAsync(UserConnection connection, CancellationToken ct = default)
    {
        context.UserOnlineStatuses.Remove(connection);
        await context.SaveChangesAsync(ct);
    }

    /// <inheritdoc />
    public async Task<int> DeleteStaleConnectionsAsync(DateTime cutoff, CancellationToken ct = default) =>
        await context.UserOnlineStatuses
            .Where(c => c.IsConnected && c.LastHeartbeat < cutoff)
            .ExecuteDeleteAsync(ct);
    
    
    // ============================== SAVE ==============================
    /// <inheritdoc />
    public async Task SaveChangesAsync(CancellationToken ct = default) =>
        await context.SaveChangesAsync(ct);
}
