using AFBack.Features.Friendship.Models;

namespace AFBack.Features.Friendship.Repository;

public interface IFriendshipRequestRepository
{
    /// <summary>
    /// Henter et FriendshipRequest mellom to brukere
    /// </summary>
    /// <param name="userId">Bruker A</param>
    /// <param name="otherUserId">Bruker B</param>
    /// <returns>FriendshipRequest eller null</returns>
    Task<FriendshipRequest?> GetFriendshipRequestAsync(string userId, string otherUserId);
    
    /// <summary>
    /// Henter en FriendshipRequest basert på ID
    /// </summary>
    /// <param name="requestId">ID-en til requesten</param>
    /// <returns>FriendshipRequest eller null</returns>
    Task<FriendshipRequest?> GetFriendshipRequestByIdAsync(int requestId);

    /// <summary>
    /// Legger til et friendshipRequest og lagrer
    /// </summary>
    Task AddFriendshipRequestAsync(FriendshipRequest friendshipRequest);
    
    Task SaveChangesAsync();
}
