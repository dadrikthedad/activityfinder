using System.Security.Claims;
using Microsoft.AspNetCore.SignalR;

namespace AFBack.Features.SignalR.Providers;

/// <summary>
/// Bestemmer hvordan SignalR identifiserer brukere.
/// Henter bruker-ID fra JWT NameIdentifier claim.
/// </summary>
public class CustomUserIdProvider : IUserIdProvider
{
    public string? GetUserId(HubConnectionContext connection)
    {
        return connection.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    }
}
