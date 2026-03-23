using AFBack.Common.Results;
using AFBack.Features.Auth.DTOs.Request;
using AFBack.Features.Auth.DTOs.Response;

namespace AFBack.Features.Auth.Services.Interfaces;

public interface IAuthService
{
    // ======================== Signup ======================== 
    /// <summary>
    /// Registrerer en ny bruker med innsendt skjema i SignupRequest.
    /// Validerer epost og telefon, oppretter User og tilhørende modeller og sender verifikasjonsepost.
    /// </summary>
    /// <param name="request">SignupRequest</param>
    /// <param name="ipAddress">IP-adressen hentet fra forespørsel</param>
    /// <param name="ct"></param>
    /// <returns>SignupResponse</returns>
    Task<Result<SignupResponse>> SignupAsync(SignupRequest request, string ipAddress, CancellationToken ct = default);
    
    
    // ======================== Login ======================== 
    /// <summary>
    /// Prøver å logge inn en bruker med epost og passord.
    /// Bruker Identity til å validere brukeren, lockout og passord.
    /// Logger Historikk og UserDevice, og oppretter nye tokens
    /// </summary>
    /// <param name="request">LoginRequest</param>
    /// <param name="ipAddress">IP-addressen til brukeren</param>
    /// <param name="userAgent">UserAgent hvis det er en browser</param>
    /// <param name="ct"></param>
    /// <returns>Returnerer AccessToken og RefreshToken ved suksess.</returns>
    Task<Result<LoginResponse>> LoginAsync(LoginRequest request, string ipAddress, string? userAgent, 
        CancellationToken ct = default);
    
    
    // ======================== Logout ======================== 

    /// <summary>
    /// Logger ut bruker fra én device.
    /// Revokerer refresh token og blacklister access token i Redis.
    /// </summary>
    /// <param name="userId">Brukerens ID</param>
    /// <param name="refreshToken">Refresh token som skal revokeres</param>
    /// <param name="accessTokenJti">JTI fra token</param>
    /// <param name="accessTokenExpiry">Expiry fra token</param>
    /// <param name="deviceId">DeviceId fra token</param>
    /// <returns>Result med Success</returns>
    Task<Result> LogoutAsync(string userId, string refreshToken, string accessTokenJti,
        DateTime accessTokenExpiry, int deviceId);

    /// <summary>
    /// Logger ut bruker fra alle devices.
    /// Revokerer alle refresh tokens og blacklister nåværende access token.
    /// </summary>
    /// <param name="userId">Brukerens ID</param>
    /// <param name="accessTokenJti">JTI fra token</param>
    /// <param name="accessTokenExpiry">Expiry fra token</param>
    /// <returns>Result med Success eller Failure</returns>
    Task<Result> LogoutAllDevicesAsync(string userId, string accessTokenJti,
        DateTime accessTokenExpiry);
    
    
    // ======================== Sikkerhetsvarsling ========================

    /// <summary>
    /// Håndterer "This wasn't me"-forespørsler fra sikkerhetsvarslings-eposter.
    /// Validerer tokenet, låser kontoen, nullstiller alle pending-endringer,
    /// og sender passord-reset epost til brukeren.
    /// </summary>
    /// <param name="token">Security alert token fra URL</param>
    /// <param name="ipAddress">IP-adressen til den som klikket lenken</param>
    /// <returns>Result med Success eller Failure</returns>
    Task<Result> ReportUnauthorizedChangeAsync(string token, string ipAddress);
    
    
    
   
}
