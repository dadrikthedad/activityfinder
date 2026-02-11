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
    /// Lagerer i databasen
    /// </summary>
    Task SaveChangesAsync();
}
