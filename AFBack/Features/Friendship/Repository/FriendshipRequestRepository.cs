using AFBack.Data;
using AFBack.Features.Friendship.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.Friendship.Repository;

public class FriendshipRequestRepository(AppDbContext context) : IFriendshipRequestRepository
{
    // ======================== GET Friendship request ========================
    /// <inheritdoc />
    public async Task<FriendshipRequest?> GetFriendshipRequestAsync(string userId, string otherUserId) =>
        await context.FriendshipRequests
            .FirstOrDefaultAsync(f => (f.SenderId == userId && f.ReceiverId == otherUserId)
                                      || (f.SenderId == otherUserId && f.ReceiverId == userId));
    
    /// <inheritdoc />
    public async Task<FriendshipRequest?> GetFriendshipRequestByIdAsync(int requestId) =>
        await context.FriendshipRequests
            .FirstOrDefaultAsync(f => f.Id == requestId);
    
    // ======================== Create ========================
    
    /// <inheritdoc />
    public async Task AddFriendshipRequestAsync(FriendshipRequest friendshipRequest)
    {
        await context.FriendshipRequests.AddAsync(friendshipRequest);
        await context.SaveChangesAsync();
    }
    
    // ======================== SAVE ========================
    
    public async Task SaveChangesAsync() => await context.SaveChangesAsync();
}
