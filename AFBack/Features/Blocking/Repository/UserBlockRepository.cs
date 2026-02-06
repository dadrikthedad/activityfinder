using AFBack.Data;
using AFBack.Features.Blocking.Models;
using AFBack.Interface.Repository;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.Blocking.Repository;

public class UserBlockRepository(AppDbContext context) : IUserBlockRepository
{
    /// <inheritdoc />
    public async Task<UserBlock?> GetAsync(string blockerId, string blockedId) =>
        await context.UserBlocks
            .FirstOrDefaultAsync(us => us.BlockerId == blockerId && us.BlockedUserId == blockedId);
    
    /// <inheritdoc />
    public async Task<bool> IsFirstUserBlockedBySecondary(string userId, string blockedById) =>
        await context.UserBlocks
            .AsNoTracking()
            .AnyAsync(x => x.BlockedUserId == userId && x.BlockerId == blockedById);
    
    /// <inheritdoc />
    public async Task AddAsync(UserBlock userBlock)
    {
        await context.UserBlocks.AddAsync(userBlock);
        await context.SaveChangesAsync();
    }
    
    /// <inheritdoc />
    public async Task DeleteAsync(UserBlock userBlock)
    {
        context.UserBlocks.Remove(userBlock);
        await context.SaveChangesAsync();
    }
    
    
}
