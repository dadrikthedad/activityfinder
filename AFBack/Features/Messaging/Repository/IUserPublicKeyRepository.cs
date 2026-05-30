using AFBack.Features.Messaging.Models;

namespace AFBack.Features.Messaging.Repository;

public interface IUserPublicKeyRepository
{
    /// <summary>
    /// Henter forrige aktive PublicKey for en bruker. Kun lov med en aktive om gangen
    /// </summary>
    /// <param name="userId">Brukeren vi henter nøkler for</param>
    /// <param name="ct"></param>
    /// <returns>UserPublicKey eller null</returns>
    Task<UserPublicKey?> GetActiveUserPublicKeyAsync(string userId, CancellationToken ct = default);

    /// <summary>
    /// 
    /// </summary>
    /// <param name="userIds"></param>
    /// <param name="ct"></param>
    /// <returns></returns>
    Task<List<UserPublicKey>> GetActiveKeysForUsersAsync(List<string> userIds, CancellationToken ct = default);
    
    /// <summary>
    /// Legger til og lagrer
    /// </summary>
    Task AddAsync(UserPublicKey userPublicKey, CancellationToken ct = default);
}
