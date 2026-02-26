using AFBack.Data;
using AFBack.Features.Auth.Models;
using AFBack.Infrastructure.Security.Enums;
using AFBack.Infrastructure.Security.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Infrastructure.Security.Repositories;

public class IpBanRepository(AppDbContext context) : IIpBanRepository
{   
    /// <inheritdoc />
    public async Task<List<IpBan>> GetAllActiveAsync() => await context.IpBans
        .Where(b => b.IsActive)
        .ToListAsync();
    
    /// <inheritdoc />
    public async Task<IpBan?> GetByIpAsync(string ipAddress) => await context.IpBans
        .Where(b => b.IpAddress == ipAddress && b.IsActive)
        .FirstOrDefaultAsync();
    
    
    /// <inheritdoc />
    // TODO: Hvor skal vi ha denne?
    public async Task<UserDevice?> GetUserDeviceIdAsync(string userId, string deviceFingerprint) =>
        await context.UserDevices
            .FirstOrDefaultAsync(ud => ud.UserId == userId && ud.DeviceFingerprint == deviceFingerprint);
    
    
    /// <inheritdoc />
    public async Task<int> DeactivateIpBanAsync(string ipAddress) 
        => await context.IpBans
        .Where(b => b.IpAddress == ipAddress && b.IsActive &&
                    b.BanType == BanType.Temporary && DateTime.UtcNow > b.ExpiresAt)
        .ExecuteUpdateAsync(setters => setters.SetProperty(b => b.IsActive, false));
    
    
    /// <inheritdoc />
    public async Task AddIpBanAsync(IpBan ipBan)
    {
        await context.IpBans.AddAsync(ipBan);
        await context.SaveChangesAsync();
    }

    public async Task SaveChangesAsync() => await context.SaveChangesAsync();
}
