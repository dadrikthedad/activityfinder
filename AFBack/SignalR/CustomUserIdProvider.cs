using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;
// Metode for å hente bruker ID og bestemme hvordan den skal identifiseres
public class CustomUserIdProvider : IUserIdProvider
{
    public string? GetUserId(HubConnectionContext connection)
    {
        // 👇 Her bestemmer vi hvordan brukeren identifiseres
        return connection.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    }
}