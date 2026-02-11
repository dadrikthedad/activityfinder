using AFBack.Constants;
using AFBack.Controllers;
using AFBack.Data;
using AFBack.DTOs;
using AFBack.Extensions;
using AFBack.Features.MessageNotifications.Service;
using AFBack.Features.SyncEvents.Services;
using AFBack.Hubs;
using AFBack.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Services;

public class ReactionService(
    AppDbContext context,
    IHubContext<UserHub> hubContext,
    IMessageNotificationService messageNotificationService,
    ILogger<UserController> logger,
    IBackgroundTaskQueue taskQueue,
    IServiceScopeFactory scopeFactory)
    : IReactionService
{
    public async Task AddReactionAsync(int messageId, int userId, string emoji)
    {
        // ✅ Hent meldingen og samtaledeltakere
        var message = await context.Messages
            .Include(m => m.Conversation)
                .ThenInclude(c => c.Participants)
                    .ThenInclude(p => p.AppUser)
                        .ThenInclude(u => u.UserProfile)
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
                var hasApprovedGroupRequest = await context.GroupRequests.AnyAsync(gr =>
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
                var hasApprovedMessageRequest = await context.MessageRequests.AnyAsync(mr =>
                    mr.ReceiverId == userId &&
                    mr.ConversationId == conversation.Id &&
                    mr.IsAccepted);

                if (!hasApprovedMessageRequest)
                    throw new UnauthorizedAccessException("Du må godkjenne samtalen før du kan reagere på meldinger.");
            }
        }

        var existingReaction = await context.Reactions
            .FirstOrDefaultAsync(r => r.MessageId == messageId && r.UserId == userId);

        var isRemoved = false;
        string? removedEmoji = existingReaction?.Emoji;

        // Oppdater databasen
        if (existingReaction != null)
        {
            context.Reactions.Remove(existingReaction);

            if (existingReaction.Emoji != emoji)
            {
                // Bruker bytter emoji
                context.Reactions.Add(new Reaction
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
            context.Reactions.Add(new Reaction
            {
                MessageId = messageId,
                UserId = userId,
                Emoji = emoji
            });
        }
        
        conversation = message.Conversation;
        conversation.LastMessageSentAt = DateTime.UtcNow;

        await context.SaveChangesAsync();
        
        // 🆕 Bygg conversation sync data ETTER SaveChanges
        var participantIdsArray = conversation.Participants.Select(p => p.UserId).ToArray();
        
        // Bygg userData fra existing data eller hent fra database
        Dictionary<int, (string FullName, string? ProfileImageUrl)> userData;
        bool hasUserData = conversation.Participants?.Any(p => p.AppUser != null) == true;
    
        if (hasUserData)
        {
            userData = conversation.Participants.ToDictionary(
                p => p.UserId,
                p => (p.AppUser.FullName, p.AppUser.ProfileImageUrl)
            );
        }
        else
        {
            userData = await SyncEventExtensions.GetUserDataAsync(context, participantIdsArray);
        }
    
        // Hent group request statuses for groups
        Dictionary<int, string>? groupRequestStatuses = null;
        if (conversation.IsGroup)
        {
            groupRequestStatuses = await SyncEventExtensions.GetGroupRequestStatusesAsync(
                context, conversation.Id, participantIdsArray);
        }

        // Bygg conversation sync data
        var conversationData = conversation.MapConversationToSyncData(
            userId, 
            userData, 
            groupRequestStatuses
        );

        var user = await context.AppUsers.FindAsync(userId);

        var reactionDto = new ReactionDto
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
            notificationDto = await messageNotificationService.CreateMessageReactionNotificationAsync(
                reactingUserId: userId,
                receiverUserId: message.SenderId.Value,
                messageId: message.Id,
                conversationId: message.ConversationId,
                emoji: emoji
            );
        }
        
        taskQueue.QueueAsync(async () => 
        {
            // Først SignalR (for øyeblikkelig UI oppdatering)
            await SendReactionUpdateAsync(participantIds, reactionDto, notificationDto);

            // Så Sync Event (for offline/bootstrap sync)
            using var scope = scopeFactory.CreateScope();
            var syncService = scope.ServiceProvider.GetRequiredService<ISyncService>();
            

            try 
            {
                object eventData;

                if (!isRemoved && removedEmoji != null)
                {
                    // Emoji ble endret
                    eventData = new { 
                        reaction = reactionDto,           // 🆕 Full reaction DTO
                        conversation = conversationData,  // 🆕 Full conversation data
                        messageId = messageId,
                        previousEmoji = removedEmoji,
                        actionAt = DateTime.UtcNow,
                        isEmojiChange = true
                    };
                }
                else
                {
                    // Vanlig add/remove
                    eventData = new { 
                        reaction = reactionDto,           // Full reaction DTO
                        conversation = conversationData,  // Full conversation data
                        messageId = messageId,
                        actionAt = DateTime.UtcNow
                    };
                }

                await syncService.CreateAndDistributeSyncEventAsync(
                    eventType: SyncEventTypes.REACTION,
                    eventData: eventData,
                    targetUserIds: participantIdsInt,
                    source: "API",
                    relatedEntityId: messageId,
                    relatedEntityType: "Message"
                );
            }
            catch (Exception ex)
            {
                logger?.LogError(ex, "Failed to create sync event for reaction. MessageId: {MessageId}, UserId: {UserId}", messageId, userId);
            }
        });
    }


    
    private async Task SendReactionUpdateAsync(IEnumerable<string>? userIds, ReactionDto reaction, MessageNotificationDTO? notification)
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
                    await hubContext.Clients.User(userId).SendAsync("ReceiveReaction", payload);
                }
                catch (Exception ex)
                {
                    // Log feilen, men fortsett med andre brukere
                    logger?.LogWarning(ex, "Failed to send reaction to appUser {UserId}", userId);
                }
            });

            await Task.WhenAll(tasks);
        }
    }
}