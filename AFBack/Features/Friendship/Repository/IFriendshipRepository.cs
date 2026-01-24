namespace AFBack.Features.Friendship.Repository;

public interface IFriendshipRepository
{
    Task<bool> FriendshipExistsAsync(string userId, string otherUserId);
}
