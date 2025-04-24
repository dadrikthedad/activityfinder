using Microsoft.AspNetCore.SignalR;
using Serilog;
using ILogger = Serilog.ILogger;

namespace AFBack.Hubs;

public class NotificationHub : Hub
{
    private readonly ILogger _logger = Log.ForContext<NotificationHub>();
    public override Task OnConnectedAsync()
    {
        var userId = Context.UserIdentifier;
        _logger.Information("🔌 Bruker tilkoblet: {UserId}", userId);
        return base.OnConnectedAsync();
    }
}