using AFBack.Features.Friendship.Models;

namespace AFBack.Features.Friendship.Repository;

public interface IFriendshipRequestRepository
{
    // ======================== GET ========================
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
    /// Teller mottatte venneforespørsler med Pending status
    /// </summary>
    /// <param name="userId">Brukren sine venneforespørsler vi sjekker</param>
    /// <returns>Int med antall forespørsler</returns>
    Task<int> GetPendingReceivedRequestsCountAsync(string userId);
    
    /// <summary>
    /// Henter alle mottatte venneforespørsler med Pending status for en bruker, med paginering
    /// </summary>
    /// <param name="userId">Mottaker av forespørslene</param>
    /// <param name="page">Side for paginering</param>
    /// <param name="pageSize">Antall pr side for paginering</param>
    /// <returns>Liste med FriendshipRequest</returns>
    Task<List<FriendshipRequest>> GetPendingReceivedRequestsAsync(
        string userId, int page, int pageSize);
    
    /// <summary>
    /// Teller mottatte venneforespørsler med Declined status
    /// </summary>
    /// <param name="userId">Brukren sine venneforespørsler vi sjekker</param>
    /// <returns>Int med antall forespørsler</returns>
    Task<int> GetDeclinedReceivedRequestsCountAsync(string userId);
    
    /// <summary>
    /// Henter mottatte venneforespørsler med Declined status, paginert
    /// </summary>
    /// <param name="userId">Mottaker av forespørslene</param>
    /// <param name="page">Side for paginering</param>
    /// <param name="pageSize">Antall pr side for paginering</param>
    /// <returns>Liste med FriendshipRequest</returns>
    Task<List<FriendshipRequest>> GetDeclinedReceivedRequestsAsync(string userId, int page, int pageSize);

    // ======================== CREATE ========================
    /// <summary>
    /// Legger til et friendshipRequest og lagrer
    /// </summary>
    Task AddFriendshipRequestAsync(FriendshipRequest friendshipRequest);
    
    // ======================== DELETE ========================
    
    /// <summary>
    /// Setter en FriendshipRequest for sletting
    /// </summary>
    /// <param name="friendshipRequest">FriendshipRequest som skal slettes</param>
    void Remove(FriendshipRequest friendshipRequest);
    
    // ======================== SAVE ========================
    
    Task SaveChangesAsync();
}
