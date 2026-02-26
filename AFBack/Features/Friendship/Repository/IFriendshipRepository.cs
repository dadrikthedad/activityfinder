using AFBack.Common.DTOs;

namespace AFBack.Features.Friendship.Repository;

public interface IFriendshipRepository
{   
    // ======================== GET ========================
    /// <summary>
    /// Sjekker om bruker A og bruker B er venner
    /// </summary>
    /// <param name="userId">Bruker A</param>
    /// <param name="otherUserId">Bruker B</param>
    /// <returns>True hvis venner eller false hvis ikke</returns>
    Task<bool> FriendshipExistsAsync(string userId, string otherUserId);

    /// <summary>
    /// Henter vennskapet mellom bruker A og bruker B. Sjekker begge veier
    /// </summary>
    /// <param name="userId">Bruker A</param>
    /// <param name="friendId">Bruker B</param>
    /// <returns>Friendship eller null</returns>
    Task<Models.Friendship?> GetFriendshipBetweenUsersAsync(string userId, string friendId);
    
    /// <summary>
    /// Henter alle venn-IDer for en bruker (begge retninger i relasjonen)
    /// </summary>
    /// <param name="userId">Brukeren vi henter vennene til</param>
    /// <returns>Liste med UserIds</returns>
    Task<List<string>> GetAllFriendIdsAsync(string userId);
    
    // ======================== CREATE ========================
    /// <summary>
    /// Oppretter et Friendship-objekt, lagrer ikke
    /// </summary>
    Task AddFriendshipAsync(Models.Friendship friendship);
    
    // ======================== DELETE ========================
    /// <summary>
    /// Setter en Friendship for sletting
    /// </summary>
    /// <param name="friendship">Friendship som skal slettes</param>
    void Remove(Models.Friendship friendship);
    
    // ======================== SEARCH ========================
    
    /// <summary>
    /// Teller venner som matcher søket
    /// </summary>
    /// <param name="userId">Brukeren sin vennelsite vi søker igjennom</param>
    /// <param name="query">Søkestreng for FullName</param>
    /// <returns>Int med antall treff</returns>
    Task<int> SearchFriendsCountAsync(string userId, string query);
    
    /// <summary>
    /// Søker etter venner basert på navn, paginert og sortert alfabetisk
    /// </summary>
    /// <param name="userId">Brukeren sin vennelsite vi søker igjennom</param>
    /// <param name="query">Søkestreng for FullName</param>
    /// <param name="page">Sidenummer</param>
    /// <param name="pageSize">Antall per side</param>
    /// <returns>Liste med UserSummaryDto</returns>
    Task<List<UserSummaryDto>> SearchFriendsAsync(string userId, string query, int page, int pageSize);
    
    Task SaveChangesAsync();
}
