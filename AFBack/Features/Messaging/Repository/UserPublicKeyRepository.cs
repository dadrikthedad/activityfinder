using AFBack.Data;
using AFBack.Features.Messaging.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.Messaging.Repository;

public class UserPublicKeyRepository(AppDbContext context) : IUserPublicKeyRepository
{
    /// <inheritdoc/>
    public async Task<UserPublicKey?> GetActiveUserPublicKeyAsync(string userId, CancellationToken ct = default) =>
        await context.UserPublicKeys
            .FirstOrDefaultAsync(k => k.UserId == userId && k.IsActive, ct);
    
    public async Task<List<UserPublicKey>> GetActiveKeysForUsersAsync(List<string> userIds, 
        CancellationToken ct = default) => 
        await context.UserPublicKeys
        .Where(k => userIds.Contains(k.UserId) && k.IsActive)
        .Include(k => k.User)
        .ToListAsync(ct);
    
    /// <inheritdoc/>
    public async Task AddAsync(UserPublicKey userPublicKey, CancellationToken ct = default)
    {
        await context.UserPublicKeys.AddAsync(userPublicKey, ct);
        await context.SaveChangesAsync(ct);
    }
    
}
