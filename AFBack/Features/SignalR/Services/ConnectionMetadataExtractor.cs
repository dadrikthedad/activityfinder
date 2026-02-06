using AFBack.Features.SignalR.Constants;
using AFBack.Features.SignalR.DTOs;
using Microsoft.AspNetCore.SignalR;

namespace AFBack.Features.SignalR.Services;

/// <summary>
/// Ekstraherer connection metadata fra SignalR HubCallerContext.
/// Statisk klasse for enkel gjenbruk og testbarhet.
/// </summary>
public static class ConnectionMetadataExtractor
{
    /// <summary>
    /// Forsøker å ekstrahere bruker-ID fra JWT claims.
    /// </summary>
    /// <param name="context">SignalR hub context</param>
    /// <param name="userId">Ekstrahert bruker-ID (string GUID), eller null hvis ugyldig</param>
    /// <returns>true hvis bruker-ID ble ekstrahert, false ellers</returns>
    public static bool TryGetUserId(HubCallerContext context, out string? userId)
    {
        userId = context.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        return !string.IsNullOrEmpty(userId);
    }

    /// <summary>
    /// Ekstraherer komplett connection metadata fra context.
    /// Leser deviceId, platform, capabilities fra query params med fallbacks.
    /// </summary>
    /// <param name="context">SignalR hub context</param>
    /// <returns>ConnectionMetadata eller null hvis bruker-ID mangler</returns>
    public static ConnectionMetadata? ExtractMetadata(HubCallerContext context)
    {
        if (!TryGetUserId(context, out var userId) || userId == null)
            return null;

        var httpContext = context.GetHttpContext();
        var request = httpContext?.Request;

        var deviceId = request?.Query[HubConstants.QueryParams.DeviceId].FirstOrDefault()
                       ?? context.ConnectionId;

        var platform = request?.Query[HubConstants.QueryParams.Platform].FirstOrDefault()
                       ?? HubConstants.Platforms.Web;

        var capabilitiesRaw = request?.Query[HubConstants.QueryParams.Capabilities].FirstOrDefault();
        var capabilities = string.IsNullOrEmpty(capabilitiesRaw) 
            ? [] 
            : capabilitiesRaw.Split(',', StringSplitOptions.RemoveEmptyEntries);

        var appVersion = request?.Query[HubConstants.QueryParams.AppVersion].FirstOrDefault();
        var userAgent = request?.Headers[HubConstants.Headers.UserAgent].FirstOrDefault();
        var remoteIp = httpContext?.Connection.RemoteIpAddress?.ToString();

        return new ConnectionMetadata
        {
            UserId = userId,
            DeviceId = deviceId,
            ConnectionId = context.ConnectionId,
            Platform = platform,
            Capabilities = capabilities,
            AppVersion = appVersion,
            UserAgent = userAgent,
            RemoteIpAddress = remoteIp,
            ConnectedAt = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Henter kun device ID fra context.
    /// Brukes primært i OnDisconnectedAsync hvor full metadata ikke trengs.
    /// </summary>
    /// <param name="context">SignalR hub context</param>
    /// <returns>Device ID fra query param, eller ConnectionId som fallback</returns>
    public static string GetDeviceId(HubCallerContext context)
    {
        return context.GetHttpContext()?.Request.Query[HubConstants.QueryParams.DeviceId].FirstOrDefault()
               ?? context.ConnectionId;
    }
}
