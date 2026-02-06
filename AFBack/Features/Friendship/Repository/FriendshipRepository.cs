using AFBack.Data;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.Friendship.Repository;

public class FriendshipRepository(AppDbContext context) : IFriendshipRepository
{

        
    /// <summary>
    /// Sjekker om bruker A og bruker B er venner
    /// </summary>
    /// <param name="userId">Bruker A</param>
    /// <param name="otherUserId">Bruker B</param>
    /// <returns>True hvis venner eller false hvis ikke</returns>
    public async Task<bool> FriendshipExistsAsync(string userId, string otherUserId) =>
        await context.Friends
            .AnyAsync(f => f.UserId == userId && f.FriendId == userId
                           || f.UserId == otherUserId && f.FriendId == userId);

}
