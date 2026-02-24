namespace AFBack.Features.Friendship.Repository;

public interface IFriendshipRepository
{   
    /// <summary>
    /// Sjekker om bruker A og bruker B er venner
    /// </summary>
    /// <param name="userId">Bruker A</param>
    /// <param name="otherUserId">Bruker B</param>
    /// <returns>True hvis venner eller false hvis ikke</returns>
    Task<bool> FriendshipExistsAsync(string userId, string otherUserId);
    
    /// <summary>
    /// Henter alle venn-IDer for en bruker (begge retninger i relasjonen)
    /// </summary>
    /// <param name="userId">Brukeren vi henter vennene til</param>
    /// <returns>Liste med UserIds</returns>
    Task<List<string>> GetAllFriendIdsAsync(string userId);
    
    /// <summary>
    /// Oppretter et Friendship-objekt, lagrer ikke
    /// </summary>
    Task AddFriendshipAsync(Models.Friendship friendship);
    
    Task SaveChangesAsync();
}
