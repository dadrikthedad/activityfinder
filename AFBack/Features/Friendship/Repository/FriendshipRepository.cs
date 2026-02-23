using AFBack.Data;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.Friendship.Repository;

public class FriendshipRepository(AppDbContext context) : IFriendshipRepository
{
    
    
    /// <inheritdoc />
    public async Task<bool> FriendshipExistsAsync(string userId, string otherUserId) =>
        await context.Friends
            .AnyAsync(f => f.UserId == userId && f.FriendId == userId
                           || f.UserId == otherUserId && f.FriendId == userId);
    
    
    /// <inheritdoc />
    public async Task<List<string>> GetAllFriendIdsAsync(string userId) =>
        await context.Friends
            .Where(f => f.UserId == userId // Enten der bruker er UserId eller FriendId
                        || f.FriendId == userId)
            .Select(f => f.UserId == userId // Hent kun ID-en til vennen
                ? f.FriendId 
                : f.UserId)
            .ToListAsync();

}
