using AFBack.Features.Auth.Models;

namespace AFBack.Features.Auth.Repositories;

public interface IRefreshTokenRepository
{
    /// <summary>
    /// Henter RefreshToken med token-egenskapen 
    /// </summary>
    /// <param name="token">Token som string</param>
    /// <returns>RefreshToken eller null</returns>
    Task<RefreshToken?> GetByTokenAsync(string token);
    
    /// <summary>
    /// Henter refresh token med navigasjonsegenskaper (UserDevice + AppUser).
    /// Brukes av RefreshAsync for å unngå ekstra DB-kall.
    /// </summary>
    /// <param name="token">Token som string</param>
    /// <returns>RefreshToken eller null</returns>
    Task<RefreshToken?> GetByTokenWithDeviceAsync(string token);
    
    /// <summary>
    /// Henter alle aktive (ikke-revokerte, ikke-utløpte) refresh tokens for en bruker
    /// </summary>
    /// <param name="userId">Brukeren vi skal hente alle tokens for</param>
    /// <returns>Liste med aktive tokens</returns>
    Task<List<RefreshToken>> GetActiveTokensByUserIdAsync(string userId);

    /// <summary>
    /// Henter alle aktive (ikke-revokerte, ikke-utløpte) refresh tokens for en spesifikk device
    /// </summary>
    /// <param name="deviceId">Device vi skal hente tokens for</param>
    /// <returns>Liste med aktive tokens</returns>
    Task<List<RefreshToken>> GetActiveTokensByDeviceIdAsync(int deviceId);
    
    Task AddAsync(RefreshToken refreshToken);
    Task SaveChangesAsync();
}
