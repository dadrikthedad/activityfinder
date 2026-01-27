using AFBack.Features.Conversation.Repository;
using AFBack.Features.MessageBroadcast.Interface;
using AFBack.Features.SyncEvents.Enums;
using AFBack.Features.SyncEvents.Services;
using AFBack.Hubs;
using AFBack.Models.Enums;
using AFBack.Services;
using Microsoft.AspNetCore.SignalR;

namespace AFBack.Features.MessageBroadcast.Service;

public class DeleteMessageBroadcastService(
    ILogger<DeleteMessageBroadcastService> logger,
    IConversationRepository conversationRepository,
    IHubContext<UserHub> hubContext,
    ISyncService syncService,
    IBackgroundTaskQueue backgroundTaskQueue,
    IServiceScopeFactory serviceScopeFactory) : IDeleteMessageBroadcastService
{
    // Se interface for summary
    public void QueueDeleteMessageBroadcast(int messageId, int conversationId, string deletedByUserId)
    {
        backgroundTaskQueue.QueueAsync(async () =>
        {
            using var scope = serviceScopeFactory.CreateScope();
            var processor = scope.ServiceProvider.GetRequiredService<IDeleteMessageBroadcastService>();
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
