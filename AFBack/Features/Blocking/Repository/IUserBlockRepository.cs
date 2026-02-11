using AFBack.Features.Blocking.Models;

namespace AFBack.Features.Blocking.Repository;

public interface IUserBlockRepository
{
    
    /// <summary>
    /// Henter UserBlock-entiteten hvor bruker A har blokkert bruker B
    /// </summary>
    /// <param name="blockerId">Bruker A</param>
    /// <param name="blockedId">Bruker B</param>
    /// <returns>UserBlock eller null</returns>
    Task<UserBlock?> GetAsync(string blockerId, string blockedId);
    
    /// <summary>
    /// Sjekker om bruker A har blitt blokkert av bruker B
    /// </summary>
    /// <param name="userId">Bruker A</param>
    /// <param name="blockedById">Bruker B</param>
    /// <returns>Ja hvis B har blokkert A, ellers false</returns>
    Task<bool> IsFirstUserBlockedBySecondary(string userId, string blockedById);
    
    /// <summary>
    /// Legger til en Userblock og lagrer i databasen
    /// </summary>
    Task AddAsync(UserBlock userBlock);

    /// <summary>
    /// Sletter en UserBlock
    /// </summary>
    /// <param name="userBlock">UserBlock som skal slettes</param>
    Task DeleteAsync(UserBlock userBlock);
    
    /// <summary>
    /// Henter alle brukere som blockerId har blokkert
    /// </summary>
    /// <param name="blockerId">Brukeren som har blokkert</param>
    /// <returns>Liste med UserBlock-entiteter inkludert BlockedAppUser navigasjonsegenskap</returns>
    Task<List<UserBlock>> GetBlockedUsersAsync(string blockerId);
}
