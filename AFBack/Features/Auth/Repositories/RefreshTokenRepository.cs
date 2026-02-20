using AFBack.Data;
using AFBack.Features.Auth.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.Auth.Repositories;

public class RefreshTokenRepository(AppDbContext context) : IRefreshTokenRepository
{
    /// <inheritdoc/>
    public async Task<RefreshToken?> GetByTokenAsync(string token) =>
        await context.RefreshTokens.FirstOrDefaultAsync(rt => rt.Token == token);
    
    /// <inheritdoc/>
    public async Task<RefreshToken?> GetByTokenWithDeviceAsync(string token) =>
        await context.RefreshTokens
            .Include(rt => rt.AppUser)
            .Include(rt => rt.UserDevice)
            .FirstOrDefaultAsync(rt => rt.Token == token);

    
    /// <inheritdoc/>
    public async Task<List<RefreshToken>> GetActiveTokensByUserIdAsync(string userId) =>
        await context.RefreshTokens
            .Where(rt => rt.UserId == userId)
            .Where(rt => !rt.IsRevoked) // Filrterer bort revoked
            .Where(rt => rt.ExpiresAt > DateTime.UtcNow) // Filtrerer bort de utgåtte
            .ToListAsync();
    
    
    /// <inheritdoc/>
    public async Task<List<RefreshToken>> GetActiveTokensByDeviceIdAsync(int deviceId) =>
        await context.RefreshTokens
            .Where(rt => rt.UserDeviceId == deviceId)
            .Where(rt => !rt.IsRevoked) // Filrterer bort revoked
            .Where(rt => rt.ExpiresAt > DateTime.UtcNow) // Filtrerer bort de utgåtte
            .ToListAsync();
    
    
    /// <inheritdoc/>
    public async Task AddAsync(RefreshToken refreshToken) =>
        await context.RefreshTokens.AddAsync(refreshToken);

    public async Task SaveChangesAsync() => await context.SaveChangesAsync();
}
