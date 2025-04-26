using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Serilog;
using ILogger = Serilog.ILogger;

namespace AFBack.Hubs;

[Authorize]
public class ChatHub : Hub
{
    private static readonly ILogger _logger = Log.ForContext<ChatHub>();

    // Eventuelt lagre hvem som er tilkoblet, hvis du trenger private meldinger
    private static readonly Dictionary<string, string> ConnectedUsers = new();

    public override async Task OnConnectedAsync()
    {
        var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userId != null)
        {
            ConnectedUsers[Context.ConnectionId] = userId;
            _logger.Information($"✅ ChatHub connected for user {userId}");
        }
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (ConnectedUsers.TryGetValue(Context.ConnectionId, out var userId))
        {
            ConnectedUsers.Remove(Context.ConnectionId);
            _logger.Information($"🔌 ChatHub disconnected for user {userId}");
        }
        await base.OnDisconnectedAsync(exception);
    }

    // Sender en kryptert melding til ALLE
    public async Task SendMessageToAll(string encryptedMessage)
    {
        await Clients.All.SendAsync("ReceiveMessage", encryptedMessage);
    }

    // Sender en kryptert melding til en SPESIFIKK bruker
    public async Task SendMessageToUser(string targetUserId, string encryptedMessage)
    {
        var connectionId = ConnectedUsers
            .FirstOrDefault(x => x.Value == targetUserId).Key;

        if (connectionId != null)
        {
            await Clients.Client(connectionId).SendAsync("ReceiveMessage", encryptedMessage);
        }
    }

    // Sender en kryptert melding til en GRUPPE (chat-gruppe f.eks.)
    public async Task SendMessageToGroup(string groupName, string encryptedMessage)
    {
        await Clients.Group(groupName).SendAsync("ReceiveMessage", encryptedMessage);
    }

    // Bli med i en gruppe (for gruppesamtaler)
    public async Task JoinGroup(string groupName)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
    }

    // Forlat en gruppe
    public async Task LeaveGroup(string groupName)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
    }
}
