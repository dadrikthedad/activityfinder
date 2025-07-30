using AFBack.Constants;
using AFBack.Controllers;
using AFBack.Data;
using AFBack.DTOs;
using AFBack.Hubs;
using AFBack.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Services;

public class ReactionService : IReactionService
{
    private readonly ApplicationDbContext _context;
    private readonly IHubContext<UserHub> _hubContext;
    private readonly MessageNotificationService _messageNotificationService;
    private readonly ILogger<UserController> _logger;
    private readonly IBackgroundTaskQueue _taskQueue;
    private readonly IServiceScopeFactory _scopeFactory;

    public ReactionService(ApplicationDbContext context, IHubContext<UserHub> hubContext, MessageNotificationService messageNotificationService,  ILogger<UserController> logger, IBackgroundTaskQueue taskQueue, IServiceScopeFactory scopeFactory)
    {
        _context = context;
        _hubContext = hubContext;
        _messageNotificationService = messageNotificationService;
        _logger = logger;
        _taskQueue = taskQueue;
        _scopeFactory = scopeFactory;
    }

    public async Task AddReactionAsync(int messageId, int userId, string emoji)
    {
        // ✅ Hent meldingen og samtaledeltakere
        var message = await _context.Messages
            .Include(m => m.Conversation)
                .ThenInclude(c => c.Participants)
            .FirstOrDefaultAsync(m => m.Id == messageId);

        if (message == null)
            throw new KeyNotFoundException($"Melding med ID {messageId} eksisterer ikke.");
        
        // 🆕 Sjekk om det er en systemmelding
        if (message.IsSystemMessage)
            throw new InvalidOperationException("Du kan ikke reagere på systemmeldinger.");
    
        // 🆕 Ekstra sikkerhet: Sjekk om meldingen har avsender
        if (!message.SenderId.HasValue)
            throw new InvalidOperationException("Kan ikke reagere på meldinger uten avsender.");
        
        // ✅ TILGANGSKONTROLL: Sjekk om brukeren har tilgang til samtalen
        var conversation = message.Conversation;
        var isParticipant = conversation.Participants.Any(p => p.UserId == userId);
    
        if (!isParticipant)
            throw new UnauthorizedAccessException("Du har ikke tilgang til denne samtalen.");

        // ✅ For grupper: Sjekk om brukeren har godkjent GroupRequest
        if (conversation.IsGroup)
        {
            bool isCreator = conversation.CreatorId == userId;
        
            if (!isCreator)
            {
                var hasApprovedGroupRequest = await _context.GroupRequests.AnyAsync(gr =>
                    gr.ReceiverId == userId &&
                    gr.ConversationId == conversation.Id &&
                    gr.Status == GroupRequestStatus.Approved);

                if (!hasApprovedGroupRequest)
                    throw new UnauthorizedAccessException("Du har ikke godkjent invitasjonen til denne gruppen.");
            }
        }

        // ✅ For 1-til-1: Sjekk om samtalen er godkjent eller du har tilgang
        if (!conversation.IsGroup && !conversation.IsApproved)
        {
            bool isCreator = conversation.CreatorId == userId;
        
            if (!isCreator)
            {
                var hasApprovedMessageRequest = await _context.MessageRequests.AnyAsync(mr =>
                    mr.ReceiverId == userId &&
                    mr.ConversationId == conversation.Id &&
                    mr.IsAccepted);

                if (!hasApprovedMessageRequest)
                    throw new UnauthorizedAccessException("Du må godkjenne samtalen før du kan reagere på meldinger.");
            }
        }

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

        //  Send alltid til alle participants (ingen gruppehåndtering)
        var participantIds = message.Conversation.Participants
            .Select(p => p.UserId.ToString())
            .ToList();
        
        var participantIdsInt = message.Conversation.Participants
            .Select(p => p.UserId)
            .ToList();

        MessageNotificationDTO? notificationDto = null;

        if (!isRemoved && message.SenderId != userId)
        {
            notificationDto = await _messageNotificationService.CreateMessageReactionNotificationAsync(
                reactingUserId: userId,
                receiverUserId: message.SenderId.Value,
                messageId: message.Id,
                conversationId: message.ConversationId,
                emoji: emoji
            );
        }
        
        _taskQueue.QueueAsync(async () => 
        {
            // Først SignalR (for øyeblikkelig UI oppdatering)
            await SendReactionUpdateAsync(participantIds, null, dto, notificationDto);

            // Så Sync Event (for offline/bootstrap sync)
            using var scope = _scopeFactory.CreateScope();
            var syncService = scope.ServiceProvider.GetRequiredService<SyncService>();

            try 
            {
                // Bestem event type basert på operasjon
                string eventType = isRemoved ? SyncEventTypes.REACTION_REMOVED : SyncEventTypes.REACTION_ADDED;

                object eventData;

                if (!isRemoved && removedEmoji != null)
                {
                    // Emoji ble endret
                    eventData = new { 
                        messageId = messageId,
                        conversationId = message.ConversationId,
                        userId = userId,
                        emoji = emoji,
                        previousEmoji = removedEmoji,
                        userFullName = user?.FullName,
                        actionAt = DateTime.UtcNow,
                        isEmojiChange = true
                    };
                }
                else
                {
                    // Vanlig add/remove
                    eventData = new { 
                        messageId = messageId,
                        conversationId = message.ConversationId,
                        userId = userId,
                        emoji = emoji,
                        userFullName = user?.FullName,
                        actionAt = DateTime.UtcNow
                    };
                }

                await syncService.CreateAndDistributeSyncEventAsync(
                    eventType: eventType,
                    eventData: eventData,
                    targetUserIds: participantIdsInt,
                    source: "API",
                    relatedEntityId: messageId,
                    relatedEntityType: "Message"
                );
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Failed to create sync event for reaction. MessageId: {MessageId}, UserId: {UserId}", messageId, userId);
            }
        });
    }


    
    private async Task SendReactionUpdateAsync(IEnumerable<string>? userIds, string? groupName, ReactionDTO reaction, MessageNotificationDTO? notification)
    {
        var payload = new
        {
            reaction,
            notification
        };

        // ✅ Send alltid til hver enkelt bruker
        if (userIds != null)
        {
            var tasks = userIds.Select(async userId =>
            {
                try
                {
                    await _hubContext.Clients.User(userId).SendAsync("ReceiveReaction", payload);
                }
                catch (Exception ex)
                {
                    // Log feilen, men fortsett med andre brukere
                    _logger?.LogWarning(ex, "Failed to send reaction to user {UserId}", userId);
                }
            });

            await Task.WhenAll(tasks);
        }
    }
}