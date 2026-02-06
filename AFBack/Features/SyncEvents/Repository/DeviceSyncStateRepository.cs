using AFBack.Data;
using AFBack.Features.SyncEvents.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.SyncEvents.Repository;

public class DeviceSyncStateRepository(AppDbContext context) : IDeviceSyncStateRepository
{   
    
    /// <summary>
    /// Henter en DeviceSyncEvent eller null
    /// </summary>
    /// <param name="userDeviceId">Enheten vi skal hente for</param>
    /// <returns>DeviceSyncState eller null</returns>
    public async Task<DeviceSyncState?> GetDeviceSyncStateAsync(int userDeviceId) =>
        await context.DeviceSyncStates
            .FirstOrDefaultAsync(d => d.UserDeviceId == userDeviceId);
    
    
    /// <summary>
    /// Legger til og lagrer en DeviceSyncState
    /// </summary>
    public async Task CreateSyncStateAsync(DeviceSyncState deviceSyncState)
    {
        await context.DeviceSyncStates.AddAsync(deviceSyncState);
        await context.SaveChangesAsync();
    }
    
    /// <summary>
    /// Lagrer til databasen
    /// </summary>
    public async Task SaveChangesAsync() => await context.SaveChangesAsync();
}
