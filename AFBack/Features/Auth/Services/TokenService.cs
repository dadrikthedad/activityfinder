using System.Security.Cryptography;
using AFBack.Common.DTOs;
using AFBack.Common.Results;
using AFBack.Configurations.Options;
using AFBack.Features.Auth.DTOs.Response;
using AFBack.Features.Auth.Models;
using AFBack.Features.Auth.Repositories;
using AFBack.Features.Auth.Services.Interfaces;
using Microsoft.AspNetCore.Identity;
using StackExchange.Redis;

namespace AFBack.Features.Auth.Services;

public class TokenService(
    IJwtService jwtService,
    IRefreshTokenRepository refreshTokenRepository,
    UserManager<AppUser> userManager,
    IConnectionMultiplexer redis,
    ILogger<TokenService> logger) : ITokenService
{
    private const string BlacklistPrefix = "token:blacklist:";
    
    /// <inheritdoc />
    public async Task<LoginResponse> GenerateTokenPairAsync(AppUser user, UserDevice device, 
        IList<string> roles, string ipAddress, string? userAgent)
    {
        // Generer access token (JWT)
        var accessToken = jwtService.GenerateJwtToken(user.Id, user.Email!, roles, device.Id);
        var accessTokenExpires = DateTime.UtcNow.AddMinutes(TokenConfig.AccessTokenMinutes);
        
        // Generer refresh token (kryptografisk sikker, opak) - varer 12 måneder
        var refreshTokenString = GenerateSecureRefreshToken();
        var refreshTokenExpires = DateTime.UtcNow.AddDays(TokenConfig.RefreshTokenDays);
        
        // Henter aktive Tokens på denne devicen for å nullstille de (pga krasj, avinstallasjon etc)
        var activeTokens = await refreshTokenRepository.GetActiveTokensByDeviceIdAsync(device.Id);
        
        // Revoker token
        foreach (var token in activeTokens)
        {
            token.IsRevoked = true;
            token.RevokedAt = DateTime.UtcNow;
            token.RevokedReason = "Replaced by new login";
        }
        
        // Lagre nytt refresh token i databasen
        var refreshToken = new RefreshToken
        {
            UserId = user.Id,
            UserDeviceId = device.Id,
            Token = refreshTokenString,
            ExpiresAt = refreshTokenExpires,
            IpAddress = ipAddress,
            UserAgent = userAgent
        };
        
        await refreshTokenRepository.AddAsync(refreshToken);
        await refreshTokenRepository.SaveChangesAsync();
        
        logger.LogInformation(
            "Token pair generated for UserId: {UserId}, DeviceId: {DeviceId}", 
            user.Id, device.Id);
        
        // Oppretter en response
        return new LoginResponse
        {
            AccessToken = accessToken,
            RefreshToken = refreshTokenString,
            AccessTokenExpires = accessTokenExpires,
            RefreshTokenExpires = refreshTokenExpires,
            User = new UserSummaryDto
            {
                Id = user.Id,
                FullName = user.FullName,
                ProfileImageUrl = user.ProfileImageUrl
            }
        };
    }
    
    /// <inheritdoc />
    public async Task<Result<LoginResponse>> RefreshAsync(string refreshToken, string deviceFingerprint,
        string ipAddress, string? userAgent)
    {
        // Finn refresh token i databasen (inkluderer UserDevice og AppUser)
        var storedToken = await refreshTokenRepository.GetByTokenWithDeviceAsync(refreshToken);
        if (storedToken == null)
        {
            logger.LogWarning("Refresh attempted with unknown token");
            return Result<LoginResponse>.Failure("Invalid refresh token");
        }
        
        // Sjekk om revokert
        if (storedToken.IsRevoked)
        {
            // Token reuse detection: Noen prøver å bruke et allerede brukt token.
            // Dette kan indikere token-tyveri. Revoker ALLE tokens for brukeren.
            logger.LogWarning("Revoked refresh token reused for UserId: {UserId}. Revoking all tokens.",
                storedToken.UserId);
            
            await RevokeAllTokensForUserAsync(storedToken.UserId, 
                "Revoked token reuse detected — possible token theft");
            
            return Result<LoginResponse>.Failure(
                "Session has been invalidated for security reasons. Please log in again.");
        }
        
        // Sjekk utløp
        if (storedToken.ExpiresAt < DateTime.UtcNow)
        {
            logger.LogInformation("Expired refresh token used for UserId: {UserId}", storedToken.UserId);
            return Result<LoginResponse>.Failure("Refresh token has expired. Please log in again.");
        }
        
        // Sjekk at device fingerprint matcher - matcher ikke hvis den er stjelt og brukes på en annen enhet
        if (storedToken.UserDevice.DeviceFingerprint != deviceFingerprint)
        {
            logger.LogWarning(
                "Refresh token device mismatch for UserId: {UserId}. " +
                "Expected device {ExpectedDevice}, got different fingerprint.",
                storedToken.UserId, storedToken.UserDeviceId);
            
            return Result<LoginResponse>.Failure("Device mismatch. Please log in again.");
        }
        
        // ====== Token rotation: Revoker gammelt, generer nytt ======
        var user = storedToken.AppUser;
        var device = storedToken.UserDevice;
        
        // Revoker gammelt refresh token
        storedToken.IsRevoked = true;
        storedToken.RevokedAt = DateTime.UtcNow;
        storedToken.RevokedReason = "Rotated during refresh";
        
        // Hent roller
        var roles = await userManager.GetRolesAsync(user);
        
        // Generer nytt token-par for å rotere tokens
        var response = await GenerateTokenPairAsync(user, device, roles, ipAddress, userAgent);
        
        // Oppdater device metadata
        device.LastUsedAt = DateTime.UtcNow;
        device.LastIpAddress = ipAddress;
        
        await refreshTokenRepository.SaveChangesAsync();
        
        logger.LogInformation(
            "Token refreshed for UserId: {UserId}, DeviceId: {DeviceId}", 
            user.Id, device.Id);
        
        return Result<LoginResponse>.Success(response);
    }
    
    /// <inheritdoc />
    public async Task RevokeTokenAsync( string userId, string refreshToken, string accessTokenJti, 
        DateTime accessTokenExpiry, string reason)
    {
        // Henter token fra databasen
        var storedToken = await refreshTokenRepository.GetByTokenAsync(refreshToken);
        
        // Revoker relevante egenskaper
        if (storedToken != null && !storedToken.IsRevoked)
        {
            storedToken.IsRevoked = true;
            storedToken.RevokedAt = DateTime.UtcNow;
            storedToken.RevokedReason = reason;
            await refreshTokenRepository.SaveChangesAsync();
        
            logger.LogInformation("Refresh token revoked for UserId: {UserId}", userId);
        }
        else
            logger.LogInformation("Token is already revoked. Token: {RefreshToken}", refreshToken);
        
        // Blacklist access token i Redis
        await BlacklistAccessTokenAsync(accessTokenJti, accessTokenExpiry);
    }
    
    /// <inheritdoc />
    public async Task RevokeAllTokensForUserAsync(string userId, string reason)
    {
        // Henter alle aktive tokens for en bruker
        var activeTokens = await refreshTokenRepository.GetActiveTokensByUserIdAsync(userId);
        
        // Revoker de
        foreach (var token in activeTokens)
        {
            token.IsRevoked = true;
            token.RevokedAt = DateTime.UtcNow;
            token.RevokedReason = reason;
        }
        
        await refreshTokenRepository.SaveChangesAsync();
        
        // Note: Vi blacklister ikke alle access tokens her fordi vi ikke har JTI-ene.
        // Access tokens utløper naturlig innen 15 min.
        // For øyeblikkelig utestengelse vil TokenBlacklistMiddleware også kunne sjekke
        // en per-bruker revokering-tidsstempel i Redis ved behov.
        
        logger.LogWarning(
            "All refresh tokens revoked for UserId: {UserId}. Reason: {Reason}. Count: {Count}",
            userId, reason, activeTokens.Count);
    }
    
    /// <inheritdoc />
    public async Task<bool> IsAccessTokenBlacklistedAsync(string jti)
    {
        // Henter referanse til databasen
        var db = redis.GetDatabase();
        // Sjekker om nøkkelen (den blacklsitede access token) eksisterer
        return await db.KeyExistsAsync($"{BlacklistPrefix}{jti}");
    }
    
    /// <inheritdoc />
    public async Task BlacklistAccessTokenAsync(string jti, DateTime expiresAt)
    {
        // Henter referanse til databasen
        var db = redis.GetDatabase();
        
        // Time to live - hvor lenge den eksisterer i Redis. Vi har med ClockSkew for å unngå et litetidsvindu token
        // ikke er blacklsited lenger
        var ttl = expiresAt.AddSeconds(TokenConfig.ClockSkewSeconds) - DateTime.UtcNow;
        
        // Hvis Time to live er høyere enn null - vi revoker access token
        if (ttl > TimeSpan.Zero)
        {
            await db.StringSetAsync($"{BlacklistPrefix}{jti}", "revoked", ttl);
            logger.LogInformation("Access token blacklisted in Redis. JTI: {Jti}, TTL: {Ttl}", jti, ttl);
        }
    }
    
    /// <summary>
    /// Genererer en kryptografisk sikker refresh token string.
    /// </summary>
    /// <returns>RefreshToken som en string</returns>
    private static string GenerateSecureRefreshToken()
    {
        // Oppretter et byte-array i ønsket størrelse fra TokenConfig
        var randomBytes = new byte[TokenConfig.RefreshTokenSizeBytes];
        
        // Fyller arrayet med tilfeldig bytes
        RandomNumberGenerator.Fill(randomBytes);
        return Convert.ToBase64String(randomBytes);
    }
}
