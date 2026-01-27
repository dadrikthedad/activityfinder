using AFBack.Common.Results;

namespace AFBack.Features.Block;

public interface IBlockService
{
    /// <summary>
    /// Sjekker blokkeringer mellom to brukere (begge veier).
    /// Returnerer feil hvis noen av brukerne har blokkert den andre.
    /// </summary>
    Task<Result> ValidateNoBlockingsAsync(string userId1, string userId2);
    
    /// <summary>
    /// Sjekker at blockerId ikke har blokkert blockedId.
    /// Bruk denne når du kun trenger å sjekke én retning.
    /// </summary>
    Task<Result> ValidateNotBlockedByUserAsync(string blockerId, string blockedId);
}
