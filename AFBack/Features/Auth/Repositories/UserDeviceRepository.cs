using AFBack.Data;
using AFBack.Features.Auth.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.Auth.Repositories;

public class UserDeviceRepository(AppDbContext context) : IUserDeviceRepository
{
    /// <inheritdoc/>
    public async Task<UserDevice?> GetByFingerprintAsync(string userId, string deviceFingerprint) =>
        await context.UserDevices
            .FirstOrDefaultAsync(ud => ud.UserId == userId 
                                       & ud.DeviceFingerprint == deviceFingerprint);


    public async Task AddAsync(UserDevice userDevice)
    {
        await context.UserDevices.AddAsync(userDevice);
        await context.SaveChangesAsync();
    }
    public async Task SaveChangesAsync() => await context.SaveChangesAsync();

}
