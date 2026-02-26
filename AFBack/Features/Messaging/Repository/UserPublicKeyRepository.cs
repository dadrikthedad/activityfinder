using AFBack.Data;
using AFBack.Features.Messaging.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.Messaging.Repository;

public class UserPublicKeyRepository(AppDbContext context) : IUserPublicKeyRepository
{
    /// <inheritdoc/>
    public async Task<UserPublicKey?> GetActiveUserPublicKeyAsync(string userId) =>
        await context.UserPublicKeys
            .FirstOrDefaultAsync(k => k.UserId == userId && k.IsActive);
    
    public async Task<List<UserPublicKey>> GetActiveKeysForUsersAsync(List<string> userIds) => 
        await context.UserPublicKeys
        .Where(k => userIds.Contains(k.UserId) && k.IsActive)
        .Include(k => k.User)
        .ToListAsync();
    
    /// <inheritdoc/>
    public async Task AddAsync(UserPublicKey userPublicKey)
    {
        await context.UserPublicKeys.AddAsync(userPublicKey);
        await context.SaveChangesAsync();
    }
    
}
