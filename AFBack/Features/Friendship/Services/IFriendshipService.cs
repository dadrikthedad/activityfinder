using AFBack.Common.DTOs;
using AFBack.Common.Results;
using AFBack.Features.Friendship.DTOs.Responses;

namespace AFBack.Features.Friendship.Services;

public interface IFriendshipService
{
    // ======================== GET ========================
    /// <summary>
    /// Henter alle venner for innlogget bruker.
    /// </summary>
    /// <param name="userId">Innlogget bruker</param>
    /// <returns>Result med liste av UserSummaryDto</returns>
    Task<Result<List<UserSummaryDto>>> GetMyFriendsAsync(string userId);
    
    /// <summary>
    /// Henter vennelisten til en annen bruker, med felles venner sortert først.
    /// </summary>
    /// <param name="userId">Innlogget bruker</param>
    /// <param name="targetUserId">Brukeren hvis venneliste vi henter</param>
    /// <returns>Result med UserFriendsResponse</returns>
    Task<Result<UserFriendsResponse>> GetUserFriendsAsync(string userId, string targetUserId);
    
    // ======================== DELETE ========================
    /// <summary>
    /// Fjerner et vennskap mellom to brukere.
    /// Sletter Friendship og FriendshipRequest. Den andre brukeren
    /// får stille SignalR og SyncEvent uten notification.
    /// </summary>
    /// <param name="userId">Brukeren som fjerner vennskapet</param>
    /// <param name="friendId">Vennen som fjernes</param>
    /// <returns>Result med Success eller Failure</returns>
    Task<Result> RemoveFriendshipAsync(string userId, string friendId);
    
    // ======================== SEARCH ========================
    /// <summary>
    /// Søker etter venner for en bruker basert på navn.
    /// </summary>
    /// <param name="userId">Innlogget bruker</param>
    /// <param name="targetUserId">Brukeren hvis venneliste vi søker i</param>
    /// <param name="query">Søkestreng</param>
    /// <param name="page">Sidenummer</param>
    /// <param name="pageSize">Antall per side</param>
    /// <returns>Result med paginert liste av UserSummaryDto</returns>
    Task<Result<PaginatedResponse<UserSummaryDto>>> SearchFriendsAsync(string userId, string targetUserId,
        string query, int page, int pageSize);
}
