using AFBack.Features.Auth.Models;

namespace AFBack.Features.Auth.Repositories;

public interface IVerificationInfoRepository
{
    /// <summary>
    /// Henter VerificationInfo for en bruker
    /// </summary>
    /// <param name="userId"></param>
    /// <param name="ct"></param>
    /// <returns>VerificationInfo eller null (Skal aldri være null)</returns>
    Task<VerificationInfo?> GetByUserIdAsync(string userId, CancellationToken ct = default);

    /// <summary>
    /// Henter VerificationInfo basert på SecurityAlertToken.
    /// Brukes for uautentisert "This wasn't me"-flyt.
    /// </summary>
    /// <param name="token">Security alert token</param>
    /// <param name="ct"></param>
    /// <returns>VerificationInfo eller null hvis tokenet ikke finnes</returns>
    Task<VerificationInfo?> GetBySecurityAlertTokenAsync(string token, CancellationToken ct = default);
    
    /// <summary>
    /// Lagerer i databasen
    /// </summary>
    Task SaveChangesAsync(CancellationToken ct = default);
}
