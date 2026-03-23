using AFBack.Data;
using AFBack.Features.Auth.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.Auth.Repositories;

public class RefreshTokenRepository(AppDbContext context) : IRefreshTokenRepository
{
    // ======================== GET  ======================== 
    /// <inheritdoc/>
    public async Task<RefreshToken?> GetByTokenAsync(string token,  CancellationToken ct = default) =>
        await context.RefreshTokens.FirstOrDefaultAsync(rt => rt.Token == token, ct);
    
    /// <inheritdoc/>
    public async Task<RefreshToken?> GetByTokenWithDeviceAsync(string token,  CancellationToken ct = default) =>
        await context.RefreshTokens
            .Include(rt => rt.AppUser)
            .Include(rt => rt.UserDevice)
            .FirstOrDefaultAsync(rt => rt.Token == token, ct);

    
    /// <inheritdoc/>
    public async Task<List<RefreshToken>> GetActiveTokensByUserIdAsync(string userId,
        CancellationToken ct = default) =>
        await context.RefreshTokens
            .Where(rt => rt.UserId == userId)
            .Where(rt => !rt.IsRevoked) // Filrterer bort revoked
            .Where(rt => rt.ExpiresAt > DateTime.UtcNow) // Filtrerer bort de utgåtte
            .ToListAsync(ct);
    
    
    /// <inheritdoc/>
    public async Task<List<RefreshToken>> GetActiveTokensByDeviceIdAsync(int deviceId,  
        CancellationToken ct = default) =>
        await context.RefreshTokens
            .Where(rt => rt.UserDeviceId == deviceId)
            .Where(rt => !rt.IsRevoked) // Filrterer bort revoked
            .Where(rt => rt.ExpiresAt > DateTime.UtcNow) // Filtrerer bort de utgåtte
            .ToListAsync(ct);
    
    // ======================== CREATE ======================== 
    
    /// <inheritdoc/>
    public async Task AddAsync(RefreshToken refreshToken,  CancellationToken ct = default) =>
        await context.RefreshTokens.AddAsync(refreshToken, ct);
    
    // ======================== DELETE ======================== 
    
    public async Task<int> DeleteExpiredAndOldRevokedAsync(
        DateTime expiredBefore, DateTime revokedBefore, CancellationToken ct) => 
        await context.RefreshTokens
            .Where(t =>
                t.ExpiresAt < expiredBefore ||
                (t.IsRevoked && t.RevokedAt < revokedBefore))
            .ExecuteDeleteAsync(ct);
    
    
    // ======================== SAVE ======================== 

    public async Task SaveChangesAsync( CancellationToken ct = default) => await context.SaveChangesAsync(ct);
}
