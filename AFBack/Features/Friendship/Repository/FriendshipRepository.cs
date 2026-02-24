using AFBack.Data;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.Friendship.Repository;

public class FriendshipRepository(AppDbContext context) : IFriendshipRepository
{
    
    // ======================== GET ========================
    /// <inheritdoc />
    public async Task<bool> FriendshipExistsAsync(string userId, string otherUserId) =>
        await context.Friendships
            .AnyAsync(f => (f.UserId == userId && f.FriendId == otherUserId)
                            || (f.UserId == otherUserId && f.FriendId == userId));
    
    
    /// <inheritdoc />
    public async Task<List<string>> GetAllFriendIdsAsync(string userId) =>
        await context.Friendships
            .Where(f => f.UserId == userId // Enten der bruker er UserId eller FriendId
                        || f.FriendId == userId)
            .Select(f => f.UserId == userId // Hent kun ID-en til vennen
                ? f.FriendId 
                : f.UserId)
            .ToListAsync();
    
    // ======================== CREATE ========================
    /// <inheritdoc />
    public async Task AddFriendshipAsync(Models.Friendship friendship) =>
        await context.Friendships.AddAsync(friendship);
  
    
    // ======================== SAVE ========================
    
    public async Task SaveChangesAsync() => await context.SaveChangesAsync();

}
