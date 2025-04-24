using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Serilog;
using ILogger = Serilog.ILogger;

namespace AFBack.Hubs;

[Authorize]
public class NotificationHub : Hub
{
    private static readonly Dictionary<string, string> _userConnections = new();

    public override Task OnConnectedAsync()
    {
        var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (userId != null)
        {
            lock (_userConnections)
            {
                _userConnections[userId] = Context.ConnectionId;
            }
        }

        return base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (userId != null)
        {
            lock (_userConnections)
            {
                _userConnections.Remove(userId);
            }
        }

        return base.OnDisconnectedAsync(exception);
    }

    public static string? GetConnectionIdForUser(string userId)
    {
        lock (_userConnections)
        {
            return _userConnections.TryGetValue(userId, out var connectionId) ? connectionId : null;
        }
    }
}