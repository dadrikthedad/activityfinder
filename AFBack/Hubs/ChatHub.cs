using System.Security.Claims;
using AFBack.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Serilog;
using ILogger = Serilog.ILogger;

namespace AFBack.Hubs;

[Authorize]
public class ChatHub : Hub
{
    private static readonly ILogger _logger = Log.ForContext<ChatHub>();
    private readonly IGroupService _groupService;
    
    public ChatHub(IGroupService groupService)
    {
        _groupService = groupService;
    }


    // Eventuelt lagre hvem som er tilkoblet, hvis du trenger private meldinger
    private static readonly Dictionary<string, string> ConnectedUsers = new();

    public override async Task OnConnectedAsync()
    {
        var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (userId != null)
        {
            _logger.Information($"✅ SignalR: Bruker {userId} koblet til ChatHub.");

            // Hent grupper brukeren er medlem av
            var groups = await _groupService.GetUserGroupsAsync(userId);

            foreach (var group in groups)
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, group.Name);
                _logger.Information($"👥 SignalR: Bruker {userId} lagt til i gruppe '{group.Name}'.");
            }
        }
        else
        {
            _logger.Warning("❗ SignalR: Klarte ikke hente bruker-ID på tilkobling.");
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (userId != null)
        {
            _logger.Information($"🔌 SignalR: Bruker {userId} frakoblet ChatHub.");
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
        _logger.Information($"👥 Bruker {Context.UserIdentifier} lagt til gruppe {groupName} live.");
    }

    // Forlat en gruppe
    public async Task LeaveGroup(string groupName)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
        _logger.Information($"🚪 Bruker {Context.UserIdentifier} fjernet fra gruppe {groupName} live.");
    }
    
    
}
