namespace AFBack.Services;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;

public class CustomUserIdProvider : IUserIdProvider
{
    public string? GetUserId(HubConnectionContext connection)
    {
        // Returnerer ID-en som string
        return connection.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    }
}