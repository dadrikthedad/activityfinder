using AFBack.Features.Auth.Models;

namespace AFBack.Features.Auth.Repositories;

public interface ILoginHistoryRepository
{
    
    /// <summary>
    /// Henter siste historikk for en brukers enhet, og da velger siste innloggede historikk
    /// </summary>
    /// <param name="userId">Brukerens ID</param>
    /// <param name="deviceId">Brukerens enhet</param>
    /// <returns>LoginHistory eller null</returns>
    Task<LoginHistory?> GetActiveLoginAsync(string userId, int deviceId);
    
    /// <summary>
    /// Henter alle aktive LoginHistories for brukeren og setter de som logget ut.
    /// Brukes for øyeblikket kun i LogoutAllDevies
    /// </summary>
    /// <param name="userId">Brukerens ID</param>
    /// <returns>Liste med alle LoginHistories</returns>
    Task<List<LoginHistory>> GetActiveLoginsByUserIdAsync(string userId);
    
    /// <summary>
    /// Oppretter med AddAsync og lagrer med SaveChangesAsync
    /// </summary>
    Task AddAsync(LoginHistory loginHistory);

    Task SaveChangesAsync();
}
