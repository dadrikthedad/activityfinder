using AFBack.Data;
using AFBack.Features.Auth.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.Auth.Repositories;

public class UserDeviceRepository(AppDbContext context) : IUserDeviceRepository
{
    /// <inheritdoc/>
    public async Task<UserDevice?> GetByFingerprintAsync(string userId, string deviceFingerprint, 
        CancellationToken ct = default) =>
        await context.UserDevices
            .FirstOrDefaultAsync(ud => ud.UserId == userId 
                                       & ud.DeviceFingerprint == deviceFingerprint, ct);


    public async Task AddAsync(UserDevice userDevice, CancellationToken ct = default)
    {
        await context.UserDevices.AddAsync(userDevice, ct);
        await context.SaveChangesAsync(ct);
    }
    public async Task SaveChangesAsync(CancellationToken ct = default) => await context.SaveChangesAsync(ct);

}
