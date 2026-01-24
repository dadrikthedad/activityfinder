using AFBack.Features.SyncEvents.Models;

namespace AFBack.Features.SyncEvents.Repository;

public interface IDeviceSyncStateRepository
{
    Task<DeviceSyncState?> GetDeviceSyncStateAsync(int userDeviceId);
    Task CreateSyncStateAsync(DeviceSyncState deviceSyncState);

    Task SaveChangesAsync();
}
