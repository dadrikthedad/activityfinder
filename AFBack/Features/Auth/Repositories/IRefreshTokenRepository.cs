using AFBack.Features.Auth.Models;

namespace AFBack.Features.Auth.Repositories;

public interface IRefreshTokenRepository
{
    /// <summary>
    /// Henter RefreshToken med token-egenskapen 
    /// </summary>
    /// <param name="token">Token som string</param>
    /// <param name="ct"></param>
    /// <returns>RefreshToken eller null</returns>
    Task<RefreshToken?> GetByTokenAsync(string token, CancellationToken ct = default);

    /// <summary>
    /// Henter refresh token med navigasjonsegenskaper (UserDevice + AppUser).
    /// Brukes av RefreshAsync for å unngå ekstra DB-kall.
    /// </summary>
    /// <param name="token">Token som string</param>
    /// <param name="ct"></param>
    /// <returns>RefreshToken eller null</returns>
    Task<RefreshToken?> GetByTokenWithDeviceAsync(string token, CancellationToken ct = default);

    /// <summary>
    /// Henter alle aktive (ikke-revokerte, ikke-utløpte) refresh tokens for en bruker
    /// </summary>
    /// <param name="userId">Brukeren vi skal hente alle tokens for</param>
    /// <param name="ct"></param>
    /// <returns>Liste med aktive tokens</returns>
    Task<List<RefreshToken>> GetActiveTokensByUserIdAsync(string userId, CancellationToken ct = default);

    /// <summary>
    /// Henter alle aktive (ikke-revokerte, ikke-utløpte) refresh tokens for en spesifikk device
    /// </summary>
    /// <param name="deviceId">Device vi skal hente tokens for</param>
    /// <param name="ct"></param>
    /// <returns>Liste med aktive tokens</returns>
    Task<List<RefreshToken>> GetActiveTokensByDeviceIdAsync(int deviceId, CancellationToken ct = default);
    
    /// <summary>
    /// Sletter utløpte tokens og revokerte tokens eldre enn cutoff-datoen.
    /// Returnerer antall slettede rader.
    /// </summary>
    /// <param name="expiredBefore">Tokens som har utgått før cutoff-datoen</param>
    /// <param name="revokedBefore">Tokens som har blitt revoked før cutoff-datoen</param>
    /// <param name="ct">CancellationToken</param>
    /// <returns>Int med antall slettede</returns>
    Task<int> DeleteExpiredAndOldRevokedAsync(DateTime expiredBefore, DateTime revokedBefore, 
        CancellationToken ct);
    
    Task AddAsync(RefreshToken refreshToken, CancellationToken ct = default);
    Task SaveChangesAsync( CancellationToken ct = default);
}
