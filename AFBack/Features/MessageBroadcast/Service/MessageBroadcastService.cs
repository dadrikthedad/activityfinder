using AFBack.Constants;
using AFBack.Data;
using AFBack.Features.MessageBroadcast.DTO.cs;
using AFBack.Features.MessageBroadcast.Interface;
using AFBack.Hubs;
using AFBack.Infrastructure.Services;
using AFBack.Interface.Services;
using AFBack.Models;
using AFBack.Interface.Repository;
using AFBack.Services;
using Microsoft.AspNetCore.SignalR;


namespace AFBack.Features.MessageBroadcast.Service;

public class MessageBroadcastService(
    ApplicationDbContext context,
    ILogger<MessageBroadcastService> logger,
    IConversationRepository conversationRepository,
    IMessageRepository messageRepository,
    IHubContext<UserHub> hubContext,
    IUserRepository userRepository,
    ISyncService syncService,
    IMessageNotificationService messageNotificationService,
    IBackgroundTaskQueue backgroundTaskQueue, 
    IServiceScopeFactory serviceScopeFactory) : BaseService<MessageBroadcastService>(logger), IMessageBroadcastService
{
    /// <summary>
    /// Her queuer vi SignalR, notifications og syncevents etter vi har sendt en melding
    /// </summary>
    /// <param name="messageId"></param>
    /// <param name="conversationId"></param>
    /// <param name="userId"></param>
    /// <param name="sentAt"></param>
    public void QueueNewMessageBackgroundTasks(int messageId, int conversationId, int userId, DateTime sentAt)
    {
        backgroundTaskQueue.QueueAsync(async () =>
        {
            using var scope = serviceScopeFactory.CreateScope();
            var backgroundProcessor = scope.ServiceProvider.GetRequiredService<IMessageBroadcastService>();
            await backgroundProcessor.ProcessMessageBroadcast(messageId, conversationId, userId, sentAt);
        });

    }
    
    /// <summary>
    /// </summary>
    /// <param name="messageId"></param>
    /// <param name="conversationId"></param>
    /// <param name="userId"></param>
    /// <param name="sentAt"></param>
    public async Task ProcessMessageBroadcast(int messageId, int conversationId, int userId, DateTime sentAt)
    {
        logger.LogDebug("MessageBroadcastService: Processing message broadcast for message Id {MessageId}", messageId);
        
        //Henter samtalen med participants
        var conversation = await conversationRepository.GetConversation(conversationId);
        
        // Henter ut alle brukerIDene for å itere igjennom de i en dict, med key = UserId og Value = ConversationStatus
        // De som har rejected uteblir
        var participantsWithStatus = conversation!.Participants
            .Where(cp => cp.ConversationStatus != ConversationStatus.Rejected)
            .ToDictionary(cp => cp.UserId, cp => cp.ConversationStatus);
        
        // Mapper og henter ut meldingen med alle egenskapene vi trenger
        var response = await messageRepository.GetAndMapMessageEncryptedMessage(messageId);
        
        // Sender SignalR til alle brukerne utenom rejected og oss selv
        await BroadcastSignalRAsync(participantsWithStatus, response, userId);
        
        // Oppdaterer lastMessageSentAt i Conversation
        conversation.LastMessageSentAt = sentAt;
        await context.SaveChangesAsync();
        
        // Oppretter og lager en meldingsforespørsel til brukerne som har godkjent/Creator, utenom brukeren som sender
        await BroadcastMessageNotificationsAsync(participantsWithStatus, response, userId, conversationId);
        
        // Oppretter en Sync Event til alle brukerene, utenom rejected
        await BroadcastSyncEventsAsync(participantsWithStatus, response, conversation);
    }

    /// <summary>
    /// Her mapper vi en EncryptedMessageBroadcastResponse og sender den via SignalR til brukerne som har godkjent eller
    /// creator. Til brukerne som har pending så sender vi en IsSilent = true for å legge til meldingen i samtalen, men
    /// ikke lage varsel/toast.
    /// </summary>
    /// <param name="participantsWithStatus"></param>
    /// <param name="response"></param>
    /// <param name="userId"></param>
    public async Task BroadcastSignalRAsync(Dictionary<int, ConversationStatus?> participantsWithStatus,  EncryptedMessageBroadcastResponse? response, int userId)
    {
        // Sender SignalR til alle participants uten om selve brukeren. De med pedning får en silent for å ikke
        // lage notifikasjon eller toast
        var signalRTasks = participantsWithStatus.Where(kvp => kvp.Key != userId).Select(async kvp => 
        {
            try
            {
                var userResponse = new EncryptedMessageBroadcastResponse
                {
                        
                    Id = response!.Id,
                    SenderId = response.Sender!.Id ,
                    Sender = response.Sender,
                    EncryptedText = response.EncryptedText,
                    KeyInfo = response.KeyInfo,
                    IV = response.IV,
                    Version = response.Version,
                    SentAt = response.SentAt,
                    ConversationId = response.ConversationId, 
                    // IsSilent bestemmes av om brukeren er pending eller accepted/creator
                    IsSilent  = kvp.Value == ConversationStatus.Pending,
                    EncryptedAttachments = response.EncryptedAttachments,
                    Reactions = response.Reactions,
                    ParentMessageId = response.ParentMessageId,
                    ParentMessagePreview = response.ParentMessagePreview,
                    ParentSender = response.ParentSender,
                    IsSystemMessage = response.IsSystemMessage,
                    IsDeleted = response.IsDeleted
                };
                    
                await hubContext.Clients.User(kvp.Key.ToString())
                    .SendAsync("IncomingMessage", userResponse);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "MessageBroadcastService: Failed to send message to user {UserId}", kvp.Key);
            }
                
        });
        
        // Kjører alle SignalR-sendingene samtidig
        await Task.WhenAll(signalRTasks);
    }
    
    /// <summary>
    /// Vi filtrerer vekk  avsender og pending-participants, og lager en notification som samtidig blir laget i frontend
    /// </summary>
    /// <param name="participantsWithStatus"></param>
    /// <param name="response"></param>
    /// <param name="userId"></param>
    /// <param name="conversationId"></param>
    public async Task BroadcastMessageNotificationsAsync(Dictionary<int, ConversationStatus?> participantsWithStatus,
        EncryptedMessageBroadcastResponse? response, int userId, int conversationId)
    {
        // Sender MessageNotification til hver bruker som har har godkjent samtalen og ikke er oss selv
        foreach (var kvp in participantsWithStatus.Where(kvp => kvp.Value != ConversationStatus.Pending && kvp.Key != userId))
        {
            try
            {
                await messageNotificationService.CreateMessageNotificationAsync(
                    recipientUserId: kvp.Key,
                    senderUserId: userId,
                    conversationId: conversationId,
                    messageId: response!.Id);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "MessageBroadcastService: Failed to create Message Notification for {UserId}", kvp.Key);
            }
        }
    }
    
    /// <summary>
    /// Vi lager et Sync Event med NEW_MESSAGE og vi mapper meldingen og samtalen til en SyncEvent TODO: SJekke at denne stemmer med frontend
    /// </summary>
    /// <param name="participantsWithStatus"></param>
    /// <param name="response"></param>
    /// <param name="conversation"></param>
    public async Task BroadcastSyncEventsAsync(Dictionary<int, ConversationStatus?> participantsWithStatus,
        EncryptedMessageBroadcastResponse? response, Conversation? conversation)
    {
        try
        {
            // Henter bruker objektene. Vi gjør dette her og ikke tidligere for å la SignalR gå så fort som mulig
            var users = await userRepository.GetUserSummaries(participantsWithStatus.Keys);
            
            // Mapper til riktig DTOer både for å lagre det i databasen, og til å senere sende til frontend med samme DTO
            var mappedNewMessageSyncEvent = new EncryptedMessageSyncEvent
            {
                Id = conversation!.Id,
                IsGroup = conversation.IsGroup,
                GroupName = conversation.GroupName,
                GroupImageUrl = conversation.GroupImageUrl,
                LastMessageSentAt = conversation.LastMessageSentAt,
                Participants = participantsWithStatus.Select(kvp => new EncryptedMessageSyncEventParticipant
                {
                    Id = kvp.Key,
                    FullName = users[kvp.Key].FullName,
                    ProfileImageUrl = users[kvp.Key].ProfileImageUrl,
                    ConversationStatus = kvp.Value
                }).ToList()
            };

        
            await syncService.CreateAndDistributeSyncEventAsync(
                eventType: SyncEventTypes.NEW_MESSAGE,
                eventData: new
                {
                    message = response,
                    conversation = mappedNewMessageSyncEvent
                },
                targetUserIds: participantsWithStatus.Keys,
                source: "API",
                relatedEntityId: response!.Id,
                relatedEntityType: "Message"

            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MessageBroadcastService: Failed to create sync event for encrypted message {MessageId}", response!.Id);
        }
    }
    
}
