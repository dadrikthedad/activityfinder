using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using AFBack.Features.Exceptions.CustomExceptions;
using AFBack.Infrastructure.Constants;

namespace AFBack.Infrastructure.Extensions;

/// <summary>
/// Extension for å hente ut claims fra JwtToken
/// </summary>
public static class ClaimsPrincipalExtensions
{
    /// <summary>
    /// Henter ut UserId fra token (NameIdentifier). Brukes i kontrollerne da den kaster feil
    /// </summary>
    /// <param name="user">Brukeren som har sendt en forespørsel</param>
    /// <returns>UserId som string</returns>
    /// <exception cref="AuthorizationException">Ingen bruker i token</exception>
    public static string GetUserId(this ClaimsPrincipal user)
    {
        var userId = user.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;

        if (string.IsNullOrWhiteSpace(userId))
            throw new AuthorizationException("UserId not found in token");

        return userId;
    }
    
    /// <summary>
    /// Returner UserId eller Null hvis ingen finnes - brukes i feks RateLimit
    /// </summary>
    /// <param name="user">Tokenet</param>
    /// <returns>UserId som en string</returns>
    public static string? GetUserIdOrDefault(this ClaimsPrincipal user) => 
        user.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
    
    
    /// <summary>
    /// Henter ut JTI (Jwt Token Identifier - ID-en til tokenet) fra token.
    /// </summary>
    /// <param name="user">Brukeren som har sendt en forespørsel</param>
    /// <returns>JTI som en string. Eks: f47ac10b-58cc-4372-a567-0e02b2c3d479</returns>
    /// <exception cref="AuthorizationException"></exception>
    public static string GetJti(this ClaimsPrincipal user)
    {
        var jti = user.FindFirst(JwtRegisteredClaimNames.Jti)?.Value;
    
        if (string.IsNullOrWhiteSpace(jti))
            throw new AuthorizationException("JTI not found in token");
    
        return jti;
    }
    
    /// <summary>
    /// Henter ut Expiry fra en Token. Når tokenet blir utløpt
    /// </summary>
    /// <param name="user">Brukeren som har sendt en forespørsel</param>
    /// <returns>Epxiry som en string. Eks: 1740067200</returns>
    /// <exception cref="AuthorizationException"></exception>
    public static DateTime GetAccessTokenExpiry(this ClaimsPrincipal user)
    {
        var exp = user.FindFirst(JwtRegisteredClaimNames.Exp)?.Value;
    
        if (string.IsNullOrWhiteSpace(exp) || !long.TryParse(exp, out var unix))
            throw new AuthorizationException("Token expiry not found in token");
    
        return DateTimeOffset.FromUnixTimeSeconds(unix).UtcDateTime;
    }
    
    
    
    /// <summary>
    /// Henter ut DeviceId fra token (DeviceId)
    /// </summary>
    /// <param name="user">Brukeren som har sendt en forespørsel</param>
    /// <returns>DeviceId som int</returns>
    /// <exception cref="AuthorizationException">Ingen bruker i token eller ikke mulig å parse til int</exception>
    public static int GetDeviceId(this ClaimsPrincipal user)
    {
        var deviceId = user.FindFirst(CustomClaimTypes.DeviceId)?.Value;

        if (string.IsNullOrWhiteSpace(deviceId))
            throw new AuthorizationException("deviceId not found in token");

        if (!int.TryParse(deviceId, out var parsedDeviceId))
            throw new AuthorizationException("Invalid DeviceId format in token");

        return parsedDeviceId;
    }
}
