using AFBack.Features.Auth.Models;

namespace AFBack.Features.Auth.Repositories;

public interface IVerificationRepository
{
    /// <summary>
    /// Henter VerificationInfo for en bruker
    /// </summary>
    /// <param name="userId"></param>
    /// <returns>VerificationInfo eller null (Skal aldri være null)</returns>
    Task<VerificationInfo?> GetByUserIdAsync(string userId);
    
    /// <summary>
    /// Henter VerificationInfo basert på SecurityAlertToken.
    /// Brukes for uautentisert "This wasn't me"-flyt.
    /// </summary>
    /// <param name="token">Security alert token</param>
    /// <returns>VerificationInfo eller null hvis tokenet ikke finnes</returns>
    Task<VerificationInfo?> GetBySecurityAlertTokenAsync(string token);
    
    /// <summary>
    /// Lagerer i databasen
    /// </summary>
    Task SaveChangesAsync();
}
