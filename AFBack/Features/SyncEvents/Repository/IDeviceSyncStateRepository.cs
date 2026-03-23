using AFBack.Features.SyncEvents.Models;

namespace AFBack.Features.SyncEvents.Repository;

public interface IDeviceSyncStateRepository
{
    /// <summary>
    /// Henter en DeviceSyncEvent eller null
    /// </summary>
    /// <param name="userDeviceId">Enheten vi skal hente for</param>
    /// <param name="ct"></param>
    /// <returns>DeviceSyncState eller null</returns>
    Task<DeviceSyncState?> GetDeviceSyncStateAsync(int userDeviceId, CancellationToken ct = default);
    
    /// <summary>
    /// Legger til og lagrer en DeviceSyncState
    /// </summary>
    Task CreateSyncStateAsync(DeviceSyncState deviceSyncState, CancellationToken ct = default);

    Task SaveChangesAsync(CancellationToken ct = default);
}
