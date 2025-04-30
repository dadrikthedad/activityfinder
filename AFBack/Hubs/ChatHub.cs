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
    private readonly ConversationService _conversationService;

    public ChatHub(ConversationService conversationService)
    {
        _conversationService = conversationService;
    }


    // Eventuelt lagre hvem som er tilkoblet, hvis du trenger private meldinger
    private static readonly Dictionary<string, string> ConnectedUsers = new();

    public override async Task OnConnectedAsync()
    {
        var userIdClaim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        
        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
        {
            _logger.Warning("❗ SignalR: Mangler eller ugyldig bruker-ID ved tilkobling.");
            await base.OnConnectedAsync();
            return;
        }

        try
        {
            // Hent alle gruppe-samtaler brukeren er med i
            var conversations = await _conversationService.GetUserConversationsAsync(userId, isGroup: true);

            foreach (var conversation in conversations)
            {
                if (!string.IsNullOrEmpty(conversation.GroupName))
                {
                    await Groups.AddToGroupAsync(Context.ConnectionId, conversation.GroupName);
                    _logger.Information($"👥 SignalR: Bruker {userId} lagt til i gruppe '{conversation.GroupName}'.");
                }
            }
        }
        catch (Exception ex)
        {
            _logger.Error(ex, $"🚨 Feil ved henting av samtaler for bruker {userId}.");
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

    // Sender en kryptert melding til ALLE. Brukes ikke
    public async Task SendMessageToAll(string encryptedMessage)
    {
        await Clients.All.SendAsync("ReceiveMessage", encryptedMessage);
    }

    // Sender en kryptert melding til en SPESIFIKK bruker. Brukes den=
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
    // 🔥 Brukes for å videresende melding til gruppe
    public async Task SendMessageToGroup(string groupName, string encryptedMessage)
    {
        await Clients.Group(groupName).SendAsync("ReceiveMessage", encryptedMessage);
    }

    // 🔥 Legg til bruker i gruppe (brukes fra controller)
    public async Task JoinGroup(string groupName)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
        _logger.Information($"👥 Bruker {Context.UserIdentifier} lagt til gruppe {groupName} live.");
    }

    public async Task LeaveGroup(string groupName)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
        _logger.Information($"🚪 Bruker {Context.UserIdentifier} fjernet fra gruppe {groupName} live.");
    }

    // 🔥 Reaksjoner på meldinger
    public async Task ReactToMessage(int messageId, string emoji)
    {
        var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId)) return;

        await Clients.All.SendAsync("ReceiveReaction", new
        {
            MessageId = messageId,
            Emoji = emoji,
            UserId = userId
        });
    }

    
    
}
