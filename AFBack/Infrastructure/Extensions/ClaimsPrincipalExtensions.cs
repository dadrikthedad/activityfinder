using System.Security.Claims;
using AFBack.Features.Exceptions.CustomExceptions;

namespace AFBack.Infrastructure.Extensions;

/// <summary>
/// Extension for å hente ut claims fra JwtToken
/// </summary>
public static class ClaimsPrincipalExtensions
{
    /// <summary>
    /// Henter ut UserId fra token (NameIdentifier)
    /// </summary>
    /// <param name="user">Brukeren som har sendt en forespørsel</param>
    /// <returns>UserId som string</returns>
    /// <exception cref="AuthorizationException">Ingen bruker i token</exception>
    public static string GetUserId(this ClaimsPrincipal user)
    {
        var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (string.IsNullOrWhiteSpace(userId))
            throw new AuthorizationException("UserId not found in token");

        return userId;
    }
    
    /// <summary>
    /// Henter ut DeviceId fra token (DeviceId)
    /// </summary>
    /// <param name="user">Brukeren som har sendt en forespørsel</param>
    /// <returns>DeviceId som int</returns>
    /// <exception cref="AuthorizationException">Ingen bruker i token eller ikke mulig å parse til int</exception>
    public static int GetDeviceId(this ClaimsPrincipal user)
    {
        var deviceId = user.FindFirst("DeviceId")?.Value;

        if (string.IsNullOrWhiteSpace(deviceId))
            throw new AuthorizationException("deviceId not found in token");

        if (!int.TryParse(deviceId, out var parsedDeviceId))
            throw new AuthorizationException("Invalid DeviceId format in token");

        return parsedDeviceId;
    }
}
