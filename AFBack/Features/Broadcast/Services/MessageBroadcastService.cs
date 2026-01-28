using AFBack.Cache;
using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.Conversation.Extensions;
using AFBack.Features.Conversation.Repository;
using AFBack.Features.MessageNotification.DTOs;
using AFBack.Features.MessageNotification.Service;
using AFBack.Features.Messaging.DTOs.Response;
using AFBack.Features.Messaging.Extensions;
using AFBack.Features.Messaging.Repository;
using AFBack.Features.SyncEvents.Enums;
using AFBack.Features.SyncEvents.Services;
using AFBack.Hubs;
using AFBack.Models.Enums;
using AFBack.Services;
using Microsoft.AspNetCore.SignalR;

namespace AFBack.Features.Broadcast.Services;

public class MessageBroadcastService(
    ILogger<MessageBroadcastService> logger,
    IConversationRepository conversationRepository,
    IMessageRepository messageRepository,
    IHubContext<UserHub> hubContext,
    ISyncService syncService,
    IMessageNotificationService messageNotificationService,
    IBackgroundTaskQueue backgroundTaskQueue, 
    IServiceScopeFactory serviceScopeFactory,
    IUserSummaryCacheService userSummariesCache) : IMessageBroadcastService
{
    
    // ======================================== Queue opp bakgrunnstasks ========================================
    public void QueueNewMessageBackgroundTasks(int messageId, int conversationId, 
        string? senderId)
    {
        backgroundTaskQueue.QueueAsync(async () =>
        {
            using var scope = serviceScopeFactory.CreateScope();
            var backgroundProcessor = scope.ServiceProvider.GetRequiredService<IMessageBroadcastService>();
            await backgroundProcessor.ProcessMessageBroadcast(messageId, conversationId, senderId);
        });
    }

    // ======================================== Meldinger ========================================
    
    public async Task ProcessMessageBroadcast(int messageId, int conversationId, string? senderId)
    {
        logger.LogDebug("Processing message broadcast for message Id {MessageId}", messageId);
        
        // Raskest mulig SignalR: Kjøre begge databasehentingene parallelt
        // Henter ut samtalen som et ConversationResponse med cache
        var getConversationTask = conversationRepository.GetConversationDtoAsync(conversationId);
        
        // Mapper og henter ut meldingen med alle egenskapene vi trenger
        var getMessageTask = messageRepository.GetMessageDtoAsync(messageId);
        
        await Task.WhenAll(getConversationTask, getMessageTask);

        var conversationDto = getConversationTask.Result;
        var messageDto = getMessageTask.Result;
        
        // Valider at meldingen og samtalen ble funnet
        if (messageDto == null || conversationDto == null)
        {
            logger.LogError("Message {MessageId} or conversation {ConversationId} not found", 
                messageId, conversationId);
            throw new InvalidOperationException($"Message {messageId} or conversation {conversationId} not found" +
                                                $"while broadcasting message");
        }
        
        // Hent user summaries fra cache
        var userIds = conversationDto.Participants.Select(p => p.UserId).ToList();

        if (messageDto.SenderId != null)
            userIds.Add(messageDto.SenderId);

        if (!messageDto.IsDeleted && messageDto.ParentSenderId != null)
            userIds.Add(messageDto.ParentSenderId);
        
        var users = await userSummariesCache.GetUserSummariesAsync(
            userIds.Distinct().ToList());
        
        // Map til response
        var conversationResponse = conversationDto.ToResponse(users);
        var messageResponse = messageDto.ToResponse(users);
        
        // Oppdaterer samtalen med tiden når meldingen ble sendt
        conversationResponse.LastMessageSentAt = messageResponse.SentAt;
        
        // Sender SignalR til alle brukerne utenom rejected og oss selv
        await BroadcastSignalRAsync(conversationResponse, messageResponse, senderId);
        
        // Oppretter notifikasjon og synceventer til alle brukerne (både avsender og alle deltakerne)
        await Task.WhenAll(
            conversationRepository.UpdateLastMessageSentAt(conversationId, messageResponse.SentAt),
            BroadcastNotificationsAndSyncEventsAsync(conversationResponse, messageResponse, senderId)
        );
    }

    /// <summary>
    /// Her mapper vi en MessageResponse og sender den via SignalR til brukerne som har Accepted en samtale eller
    /// creator. Til brukerne som har samtalen Pending så sender vi en IsSilent = true for å legge til meldingen i
    /// samtalen, men ikke lage varsel/toast. Filtrerer bort Pending i gruppesamtaler
    /// </summary>
    /// <param name="conversationResponse"></param>
    /// <param name="response"></param>
    /// <param name="senderId"></param>
    private async Task BroadcastSignalRAsync(ConversationResponse conversationResponse, 
        MessageResponse response, string? senderId)
    {
        // Sender SignalR til alle participants uten om selve brukern som har godkjent.
        // De med pending i PendingRequest får en silent for å ikke lage notifikasjon eller toast
        var signalRTasks = conversationResponse.Participants
                // Hvis det er en gruppe, så filtrert vi bort Pending
            .Where(p => p.User.Id != senderId && // Filterer bort avsender
                        (conversationResponse.Type != ConversationType.GroupChat || // ikke-gruppe: Send til mottaker
                         p.Status != ConversationStatus.Pending)) // Gruppe: kun accepted
            .Select(async participant => 
        {
            try
            {
                // Opprett et nytt Record/Response kun med forskjellig isSilent utifra om brukeren skal få notifikasjon
                // Hvis Pending 1-1 samtale, ingen notifikasjon
                var userResponse = response with
                {
                    IsSilent = participant.Status == ConversationStatus.Pending
                };
                
                await hubContext.Clients.User(participant.User.Id)
                    .SendAsync("IncomingMessage", userResponse);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to send message to appUser {UserId}", participant.User.Id);
            }
        });
        
        // Kjører alle SignalR-sendingene samtidig
        await Task.WhenAll(signalRTasks);
    }
    
    
    /// <summary>
    /// Oppretter MessageNotifications og SyncEvents for alle mottakere i én operasjon.
    /// Avsender får SyncEvent uten notification, mottakere får begge deler.
    /// </summary>
    /// <param name="conversationResponse">Samtalen som har fått ny melding</param>
    /// <param name="messageResponse">MessageResponse</param>
    /// <param name="senderId">Avsender</param>
    private async Task BroadcastNotificationsAndSyncEventsAsync(
        ConversationResponse conversationResponse,
        MessageResponse messageResponse,
        string? senderId)
    {
        // Hent alle brukere som skal få SyncEvent
        var targetedUserIds = conversationResponse.Type == ConversationType.GroupChat
            ? conversationResponse.Participants
                .Where(p => p.Status == ConversationStatus.Accepted)
                .Select(p => p.User.Id).ToList()
            : conversationResponse.Participants
                .Select(p => p.User.Id).ToList();
        
        // For hver bruker så oppretter vi MessageNotification (hvis brukern er accepted, og ikke avsender) og syncevent
        var tasks = targetedUserIds.Select(async userId =>
        {
            // MessageNotificationResponse er null til avsender og systemmeldinger
            MessageNotificationResponse? notification = null;

            // Lag notification kun for mottakere (ikke avsender, ikke systemmeldinger) Pending brukere får kun
            // SyncEvent som frontend håndterer stille
            var isAccepted = conversationResponse.Participants
                .Any(p => p.User.Id == userId && p.Status == ConversationStatus.Accepted);

            var shouldCreateNotification = userId != senderId 
                                           && !messageResponse.IsSystemMessage
                                           && isAccepted;

            if (shouldCreateNotification)
            {
                try
                {
                    notification = await messageNotificationService.CreateNewMessageNotificationAsync(
                        userId,
                        senderId!,
                        conversationResponse,
                        messageResponse);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Failed to create MessageNotification for {UserId}", userId);
                }
            }

            // Lag SyncEvent for alle (med eller uten notification - Systemmeldinger skal ha en silent syncevent)
            try
            {
                await syncService.CreateSyncEventsAsync(
                    [userId],
                    SyncEventType.NewMessage,
                    new
                    {
                        Message = messageResponse,
                        Conversation = conversationResponse,
                        Notification = notification
                    });
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to create SyncEvent for {UserId}", userId);
            }
        });

        await Task.WhenAll(tasks);
    }
    
    
    
     // Se interface for summary
    public void QueueDeleteMessageBroadcast(int messageId, int conversationId, string deletedByUserId)
    {
        backgroundTaskQueue.QueueAsync(async () =>
        {
            using var scope = serviceScopeFactory.CreateScope();
            var processor = scope.ServiceProvider.GetRequiredService<IMessageBroadcastService>();
            await processor.ProcessDeleteMessageBroadcastAsync(messageId, conversationId, deletedByUserId);
        });
    }
    
    // Se interface for summary
    public async Task ProcessDeleteMessageBroadcastAsync(int messageId, int conversationId, string deletedByUserId)
    {
        logger.LogDebug(
            "Processing delete message broadcast for message {MessageId} in conversation {ConversationId}",
            messageId, conversationId);
        
        // Hent samtalen for å få deltakerne
        var conversation = await conversationRepository.GetConversationAsync(conversationId);
        
        if (conversation == null)
        {
            logger.LogError("Conversation {ConversationId} not found while broadcasting message deletion", 
                conversationId);
            return;
        }
        
        // Filtrer til kun aksepterte deltakere
        var acceptedParticipants = conversation.Participants
            .Where(p => p.Status == ConversationStatus.Accepted)
            .ToList();
        
        // Payload for SignalR og SyncEvent
        var deletePayload = new
        {
            MessageId = messageId,
            ConversationId = conversationId
        };
        
        // ============ SIGNALR ============
        
        var signalRTasks = acceptedParticipants
            .Select(async participant =>
            {
                try
                {
                    await hubContext.Clients.User(participant.UserId)
                        .SendAsync("MessageDeleted", deletePayload);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, 
                        "Failed to send MessageDeleted SignalR to user {UserId}", 
                        participant.UserId);
                }
            });
        
        await Task.WhenAll(signalRTasks);
        
        // ============ SYNC EVENTS ============
        
        try
        {
            var targetUserIds = acceptedParticipants
                .Select(p => p.UserId)
                .ToList();
            
            await syncService.CreateSyncEventsAsync(
                targetUserIds, 
                SyncEventType.MessageDeleted, 
                deletePayload);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, 
                "Failed to create sync events for deleted message {MessageId}", 
                messageId);
        }
        
        logger.LogDebug(
            "Successfully broadcast message deletion for message {MessageId} to {Count} participants",
            messageId, acceptedParticipants.Count);
    }
}
