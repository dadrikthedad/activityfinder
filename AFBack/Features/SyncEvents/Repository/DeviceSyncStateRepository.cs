using AFBack.Data;
using AFBack.Features.SyncEvents.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.SyncEvents.Repository;

public class DeviceSyncStateRepository(AppDbContext context) : IDeviceSyncStateRepository
{
    /// <inheritdoc />
    public async Task<DeviceSyncState?> GetDeviceSyncStateAsync(int userDeviceId, CancellationToken ct = default) =>
        await context.DeviceSyncStates
            .FirstOrDefaultAsync(d => d.UserDeviceId == userDeviceId, ct);
    
    /// <inheritdoc />
    public async Task CreateSyncStateAsync(DeviceSyncState deviceSyncState, CancellationToken ct = default)
    {
        await context.DeviceSyncStates.AddAsync(deviceSyncState, ct);
        await context.SaveChangesAsync(ct);
    }
    
    /// <summary>
    /// Lagrer til databasen
    /// </summary>
    public async Task SaveChangesAsync(CancellationToken ct = default) => await context.SaveChangesAsync(ct);
}
