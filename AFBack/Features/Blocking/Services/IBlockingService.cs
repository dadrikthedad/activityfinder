using AFBack.Common.Results;

namespace AFBack.Features.Blocking.Services;

public interface IBlockingService
{

    /// <summary>
    /// Bruker A blokkerer Bruker B. Validerer, fjerner fra CanSend og oppdaterer
    /// SyncEvent for brukern som blokkerte
    /// </summary>
    /// <param name="userId">Bruker A</param>
    /// <param name="targetUserId">Bruker B</param>
    /// <returns>Result</returns>
    Task<Result> BlockUserAsync(string userId, string targetUserId);
    
    /// <summary>
    /// Bruker A fjerner blokkeringen bruker A har satt på bruker B. Validerer, legger til CanSend og
    /// SyncEvent for brukeren som fjernet blokkeringen
    /// </summary>
    /// <param name="userId">Bruker A</param>
    /// <param name="targetUserId">Bruker B</param>
    /// <returns>Result</returns>
    Task<Result> UnblockUserAsync(string userId, string targetUserId);
    
    /// <summary>
    /// Sjekker blokkeringer mellom to brukere (begge veier).
    /// Returnerer feil hvis noen av brukerne har blokkert den andre.
    /// </summary>
    /// <param name="userId1">Bruker A</param>
    /// <param name="userId2">Bruker B</param>
    /// <returns>Result med Success hvis ingen har blokkert hverandre, eller false hvis en eller flere
    /// er blokkert</returns>
    Task<Result> ValidateNoBlockingsAsync(string userId1, string userId2);
    
    /// <summary>
    /// Sjekker at blockerId ikke har blokkert blockedId.
    /// Bruk denne når du kun trenger å sjekke én retning.
    /// </summary>
    /// <param name="blockerId">Bruker A</param>
    /// <param name="blockedId">Bruker B</param>
    /// <returns>Result success hvis A ikke har blokkert B</returns>
    Task<Result> ValidateNotBlockedByUserAsync(string blockerId, string blockedId);
}
