using AFBack.Features.Broadcast.DTOs;
using AFBack.Features.Broadcast.Services.Interfaces;
using AFBack.Features.Conversation.Enums;
using AFBack.Features.Conversation.Extensions;
using AFBack.Features.Conversation.Repository;
using AFBack.Features.FileHandling.Services;
using AFBack.Features.MessageNotifications.DTOs;
using AFBack.Features.MessageNotifications.Service;
using AFBack.Features.Messaging.Extensions;
using AFBack.Features.Messaging.Repository;
using AFBack.Features.Reactions.Enums;
using AFBack.Features.SignalR.Constants;
using AFBack.Features.SignalR.Services;
using AFBack.Features.SyncEvents.Enums;
using AFBack.Features.SyncEvents.Services;
using AFBack.Infrastructure.BackgroundJobs;
using AFBack.Infrastructure.Cache;

namespace AFBack.Features.Broadcast.Services;

public class ReactionBroadcastService(
    ILogger<ReactionBroadcastService> logger,
    IConversationRepository conversationRepository,
    IMessageRepository messageRepository,
    ISignalRNotificationService signalRNotificationService,
    ISyncService syncService,
    IBackgroundTaskQueue backgroundTaskQueue,
    IServiceScopeFactory serviceScopeFactory,
    IUserSummaryCacheService userSummariesCache,
    IBlobUrlBuilder blobUrlBuilder,
    IMessageNotificationService messageNotificationService) : IReactionBroadcastService
{
    // ======================================== Queue ========================================

    /// <inheritdoc />
    public void QueueReactionBroadcast(string reactingUserId, int conversationId, int messageId,
        ReactionAction reactionAction)
    {
        backgroundTaskQueue.QueueAsync(async () =>
        {
            using var scope = serviceScopeFactory.CreateScope();
            var broadcastService = scope.ServiceProvider.GetRequiredService<IReactionBroadcastService>();
            await broadcastService.ProcessReactionBroadcastAsync(reactingUserId, conversationId, messageId, 
                reactionAction);
        });
    }

    /// <inheritdoc />
    public void QueueReactionRemovedBroadcast(string reactingUserId, int conversationId, int messageId)
    {
        backgroundTaskQueue.QueueAsync(async () =>
        {
            using var scope = serviceScopeFactory.CreateScope();
            var broadcastService = scope.ServiceProvider.GetRequiredService<IReactionBroadcastService>();
            await broadcastService.ProcessReactionRemovedBroadcastAsync(reactingUserId, conversationId, messageId);
        });
    }

    // ======================================== Added/Updated ========================================

    /// <inheritdoc />
    public async Task ProcessReactionBroadcastAsync(string reactingUserId, int conversationId, int messageId,
        ReactionAction reactionAction)
    {
        logger.LogDebug("Processing reaction broadcast for message {MessageId} by user {UserId}",
            messageId, reactingUserId);

        // Hent conversation og message parallelt
        var getConversationTask = conversationRepository.GetConversationDtoAsync(conversationId);
        var getMessageTask = messageRepository.GetMessageDtoAsync(messageId);

        await Task.WhenAll(getConversationTask, getMessageTask);

        var conversationDto = getConversationTask.Result;
        var messageDto = getMessageTask.Result;

        if (conversationDto == null || messageDto == null)
        {
            logger.LogError("Conversation {ConversationId} or message {MessageId} not found for reaction" +
                            " broadcast", conversationId, messageId);
            throw new InvalidOperationException($"Message {messageId} or conversation {conversationId} " +
                                                $"not found while broadcasting reaction");
        }

        // Hent user summaries fra cache
        var userIds = conversationDto.Participants.Select(p => p.UserId).ToList();

        if (messageDto.SenderId != null)
            userIds.Add(messageDto.SenderId);

        if (!messageDto.IsDeleted && messageDto.ParentSenderId != null)
            userIds.Add(messageDto.ParentSenderId);

        var users = await userSummariesCache.GetUserSummariesAsync(
            userIds.Distinct().ToList());

        // Map til responses
        var conversationResponse = conversationDto.ToResponse(users);
        var messageResponse = messageDto.ToResponse(users, blobUrlBuilder);

        // Finn aksepterte deltakere
        var acceptedParticipantIds = conversationResponse.Participants
            .Where(p => p.Status == ConversationStatus.Accepted)
            .Select(p => p.User.Id)
            .ToList();

        // Opprett notification til meldingseieren
        MessageNotificationResponse? notification = null;
        if (messageDto.SenderId != null)
        {
            notification = await messageNotificationService.CreateReactionNotificationAsync(
                messageDto.SenderId, reactingUserId, conversationResponse, 
                messageResponse, reactionAction);
        }

        // SignalR til alle aksepterte deltakere
        var reactionBroadcastPayload = new ReactionUpdatedBroadcastPayload
        {
            ConversationResponse = conversationResponse,
            MessageResponse = messageResponse,
            ReactionAction = reactionAction,
            MessageNotificationResponse = null
        };

        var otherParticipantIds = acceptedParticipantIds
            .Where(id => id != messageDto.SenderId)
            .ToList();

        // Andre deltakere — uten notification
        await BroadcastToParticipantsAsync(otherParticipantIds, 
            HubConstants.ClientEvents.ReactionUpdated, SyncEventType.ReactionUpdated, 
            reactionBroadcastPayload, $"reaction on message {messageId}", reactingUserId);

        // Meldingseier — med notification
        if (messageDto.SenderId != null && notification != null)
        {
            // Endrer payload og legger til MEssageNotificaiton til eieren
            var ownerPayload = reactionBroadcastPayload with { MessageNotificationResponse = notification };

            await BroadcastToParticipantsAsync([messageDto.SenderId],
                HubConstants.ClientEvents.ReactionUpdated, 
                SyncEventType.ReactionUpdated, ownerPayload,
                $"reaction notification on message {messageId} to owner {messageDto.SenderId}",
                reactingUserId);
        }
    }
    
    /// <summary>
    /// Sender SignalR deretter SyncEvent med oppdatering av reaksjon. Sender til alle brukere som er
    /// Accepted, som da har tillatelse til å se og reagere i en samtale.
    /// </summary>
    /// <param name="participantIds">Brukere som har godkjent samtalen</param>
    /// <param name="signalREvent">SignalR eventet - const string</param>
    /// <param name="syncEventType">Type Sync Event-enum</param>
    /// <param name="payload">Payload som et object vi sender</param>
    /// <param name="context">Context for logging</param>
    /// <param name="excludeFromSignalR">Bruker/brukere som ikke er med</param>
    private async Task BroadcastToParticipantsAsync(List<string> participantIds, string signalREvent,
        SyncEventType syncEventType, object payload, string context, string? excludeFromSignalR = null)
    {
        // Ingen mottakere
        if (participantIds.Count == 0) 
            return;
        
        var signalRRecipients = excludeFromSignalR != null
            ? participantIds.Where(id => id != excludeFromSignalR).ToList()
            : participantIds;
        
        // En samtale har alltid 2 eller flere samtaler. Kun 1 participant, send til meldingsen eier
        if (signalRRecipients.Count == 1) 
            await signalRNotificationService.SendToUserAsync(signalRRecipients[0], signalREvent, payload, context);
        else
            await signalRNotificationService.SendToUsersAsync(signalRRecipients, signalREvent, payload, context);
        
        try
        {
            await syncService.CreateSyncEventsAsync(participantIds, syncEventType, payload);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create SyncEvent '{EventType}' for {Context}", 
                syncEventType, context);
        }
    }

    // ======================================== Removed ========================================

    /// <inheritdoc />
    public async Task ProcessReactionRemovedBroadcastAsync(string reactingUserId, int conversationId, int messageId)
    {
        logger.LogDebug("Processing reaction removed broadcast for message {MessageId} by user {UserId}",
            messageId, reactingUserId);

        var acceptedParticipantIds = await conversationRepository.
            GetAcceptedParticipantIdsAsync(conversationId);
        

        var payload = new ReactionRemovedBroadcastPayload
        {
            ConversationId = conversationId,
            MessageId = messageId,
            UserId = reactingUserId
        };

        await BroadcastToParticipantsAsync(acceptedParticipantIds, 
            HubConstants.ClientEvents.ReactionRemoved, SyncEventType.ReactionRemoved, payload,
            $"reaction removed on message {messageId}", reactingUserId);
    }
}
