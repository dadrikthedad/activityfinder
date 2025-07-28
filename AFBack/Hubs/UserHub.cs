using System.Security.Claims;
using AFBack.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Serilog;
using ILogger = Serilog.ILogger;

namespace AFBack.Hubs;

[Authorize]
public class UserHub : Hub
{
    private static readonly ILogger _logger = Log.ForContext<UserHub>();
    private readonly ConversationService _conversationService;

    public UserHub(ConversationService conversationService)
    {
        _conversationService = conversationService;
    }

    public override async Task OnConnectedAsync()
    {
        var userIdClaim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        
        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
        {
            _logger.Warning("❗ SignalR: Mangler eller ugyldig bruker-ID ved tilkobling.");
            await base.OnConnectedAsync();
            return;
        }

        _logger.Information($"✅ SignalR: Bruker {userId} tilkoblet UserHub.");
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (userId != null)
        {
            _logger.Information($"🔌 SignalR: Bruker {userId} frakoblet UserHub.");
            
            if (exception != null)
            {
                _logger.Warning(exception, $"⚠️ SignalR: Bruker {userId} frakoblet med feil.");
            }
        }

        await base.OnDisconnectedAsync(exception);
    }
}
