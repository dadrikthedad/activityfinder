using AFBack.Data;
using AFBack.DTOs;
using AFBack.Helpers;
using AFBack.Hubs;
using AFBack.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Services;

public class ReactionService : IReactionService
{
    private readonly ApplicationDbContext _context;
    private readonly IHubContext<ChatHub> _hubContext;
    private readonly MessageNotificationService _messageNotificationService;

    public ReactionService(ApplicationDbContext context, IHubContext<ChatHub> hubContext, MessageNotificationService messageNotificationService)
    {
        _context = context;
        _hubContext = hubContext;
        _messageNotificationService = messageNotificationService;
    }

    public async Task AddReactionAsync(int messageId, int userId, string emoji)
    {
        // ✅ Valider emoji
        if (!AllowedReactions.Emojis.Contains(emoji))
            throw new Exception("Ugyldig emoji. Denne reaksjonen er ikke tillatt.");

        // ✅ Hent meldingen og samtaledeltakere
        var message = await _context.Messages
            .Include(m => m.Conversation)
                .ThenInclude(c => c.Participants)
            .FirstOrDefaultAsync(m => m.Id == messageId);

        if (message == null)
            throw new KeyNotFoundException($"Melding med ID {messageId} eksisterer ikke.");

        var existingReaction = await _context.Reactions
            .FirstOrDefaultAsync(r => r.MessageId == messageId && r.UserId == userId);

        var isRemoved = false;
        string? removedEmoji = existingReaction?.Emoji;

        // Oppdater databasen
        if (existingReaction != null)
        {
            _context.Reactions.Remove(existingReaction);

            if (existingReaction.Emoji != emoji)
            {
                // Bruker bytter emoji
                _context.Reactions.Add(new Reaction
                {
                    MessageId = messageId,
                    UserId = userId,
                    Emoji = emoji
                });
            }
            else
            {
                // Bruker fjerner emoji
                isRemoved = true;
            }
        }
        else
        {
            // Første reaksjon
            _context.Reactions.Add(new Reaction
            {
                MessageId = messageId,
                UserId = userId,
                Emoji = emoji
            });
        }

        await _context.SaveChangesAsync();

        var user = await _context.Users.FindAsync(userId);

        var dto = new ReactionDTO
        {
            MessageId = messageId,
            UserId = userId,
            Emoji = emoji,
            UserFullName = user?.FullName,
            ConversationId = message.ConversationId,
            IsRemoved = isRemoved
        };

        var recipients = message.Conversation.IsGroup && !string.IsNullOrEmpty(message.Conversation.GroupName)
            ? null
            : message.Conversation.Participants.Select(p => p.UserId.ToString()).ToList();

        MessageNotificationDTO? notificationDto = null;

        if (!isRemoved && message.SenderId != userId)
        {
            notificationDto = await _messageNotificationService.CreateMessageReactionNotificationAsync(
                reactingUserId: userId,
                receiverUserId: message.SenderId,
                messageId: message.Id,
                conversationId: message.ConversationId,
                emoji: emoji
            );
        }

        // ✅ Send bare én oppdatering via SignalR
        await SendReactionUpdateAsync(recipients, message.Conversation.GroupName, dto, notificationDto);
    }


    
    private async Task SendReactionUpdateAsync(IEnumerable<string>? userIds, string? groupName, ReactionDTO reaction, MessageNotificationDTO? notification)
    {
        var payload = new
        {
            reaction,
            notification
        };

        var tasks = new List<Task>();

        if (!string.IsNullOrEmpty(groupName))
        {
            tasks.Add(_hubContext.Clients.Group(groupName).SendAsync("ReceiveReaction", payload));
        }

        if (userIds != null)
        {
            foreach (var userId in userIds)
            {
                tasks.Add(_hubContext.Clients.User(userId).SendAsync("ReceiveReaction", payload));
            }
        }

        await Task.WhenAll(tasks);
    }
}