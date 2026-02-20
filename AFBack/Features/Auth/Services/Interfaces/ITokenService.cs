using AFBack.Common.Results;
using AFBack.Features.Auth.DTOs.Response;
using AFBack.Features.Auth.Models;

namespace AFBack.Features.Auth.Services.Interfaces;

/// <summary>
/// Håndterer alt relatert til access tokens og refresh tokens:
/// generering, refresh med rotation, revokering og Redis blacklisting.
/// </summary>
public interface ITokenService
{
    /// <summary>
    /// Genererer et nytt access/refresh token-par for en bruker og device.
    /// Oppretter RefreshToken i databasen knyttet til UserDevice.
    /// </summary>
    /// <param name="user">Brukeren som logger inn</param>
    /// <param name="device">Device som brukes</param>
    /// <param name="roles">Brukerens roller for JWT-claims</param>
    /// <param name="ipAddress">IP-adressen til brukeren</param>
    /// <param name="userAgent">User-Agent header</param>
    /// <returns>LoginResponse med begge tokens og utløpstider</returns>
    Task<LoginResponse> GenerateTokenPairAsync(AppUser user, UserDevice device,
        IList<string> roles, string ipAddress, string? userAgent);
    
    /// <summary>
    /// Fornyer access token ved å validere refresh token.
    /// Roterer refresh token (gammel revokeres, ny opprettes).
    /// Sjekker at device fingerprint matcher.
    /// </summary>
    /// <param name="refreshToken">Nåværende refresh token</param>
    /// <param name="deviceFingerprint">Device fingerprint for verifisering</param>
    /// <param name="ipAddress">IP-adressen til brukeren</param>
    /// <param name="userAgent">User-Agent header</param>
    /// <returns>Nytt LoginResponse eller Failure</returns>
    Task<Result<LoginResponse>> RefreshAsync(string refreshToken, string deviceFingerprint,
        string ipAddress, string? userAgent);

    /// <summary>
    /// Revokerer et spesifikt refresh token og blacklister tilhørende access token i Redis.
    /// </summary>
    /// <param name="userId">BrukerId for logging</param>
    /// <param name="refreshToken">Refresh token som skal revokeres</param>
    /// <param name="accessTokenJti">JTI fra nåværende access token (for Redis blacklist)</param>
    /// <param name="accessTokenExpiry">Utløpstid for access token (for Redis TTL)</param>
    /// <param name="reason">Grunn til revokering</param>
    Task RevokeTokenAsync(string userId, string refreshToken, string accessTokenJti, 
        DateTime accessTokenExpiry, string reason);
    
    /// <summary>
    /// Revokerer ALLE refresh tokens for en bruker og blacklister alle aktive access tokens.
    /// Brukes ved "Logg ut fra alle enheter" og ved sikkerhetshendelser.
    /// </summary>
    /// <param name="userId">Brukeren som logges ut overalt</param>
    /// <param name="reason">Grunn til revokering som string</param>
    Task RevokeAllTokensForUserAsync(string userId, string reason);
    
    /// <summary>
    /// Sjekker om et access token er blacklistet i Redis.
    /// Kalles av TokenBlacklistMiddleware for hvert autentisert request.
    /// </summary>
    /// <param name="jti">JWT ID (JTI) fra access token</param>
    /// <returns>True hvis blacklistet</returns>
    Task<bool> IsAccessTokenBlacklistedAsync(string jti);
    
    /// <summary>
    /// Blacklister et access token i Redis med TTL lik gjenværende levetid.
    /// Etter utløp fjernes det automatisk fra Redis.
    /// </summary>
    /// <param name="jti">JWT ID (JTI)</param>
    /// <param name="expiresAt">Access token utløpstid</param>
    Task BlacklistAccessTokenAsync(string jti, DateTime expiresAt);
    
    
}
