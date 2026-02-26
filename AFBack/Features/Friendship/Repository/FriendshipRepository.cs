using AFBack.Common.DTOs;
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
    public async Task<Models.Friendship?> GetFriendshipBetweenUsersAsync(string userId, string friendId)
        => await context.Friendships
            .FirstOrDefaultAsync(f => (f.UserId == userId && f.FriendId == friendId)
                                      || (f.UserId == friendId && f.FriendId == userId));
    
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
    
    // ======================== DELETE ========================
    /// <inheritdoc />
    public void Remove(Models.Friendship friendship) => context.Friendships.Remove(friendship);
    
    // ======================== SEARCH ========================
    
    /// <inheritdoc />
    public async Task<int> SearchFriendsCountAsync(string userId, string query)
        => await context.Friendships
            .AsNoTracking()
            .Where(f => f.UserId == userId || f.FriendId == userId)
            .Select(f => f.UserId == userId ? f.Friend : f.User)
            .CountAsync(u => u.FullName.ToLower().Contains(query.ToLower()));
    
    /// <inheritdoc />
    public async Task<List<UserSummaryDto>> SearchFriendsAsync(
        string userId, string query, int page, int pageSize)
        => await context.Friendships
            .AsNoTracking()
            .Where(f => f.UserId == userId || f.FriendId == userId)
            .Select(f => f.UserId == userId ? f.Friend : f.User)
            .Where(u => u.FullName.ToLower().Contains(query.ToLower()))
            .OrderBy(u => u.FullName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new UserSummaryDto
            {
                Id = u.Id,
                FullName = u.FullName,
                ProfileImageUrl = u.ProfileImageUrl
            })
            .ToListAsync();

    
    
    // ======================== SAVE ========================
    
    public async Task SaveChangesAsync() => await context.SaveChangesAsync();

}
