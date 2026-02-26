using AFBack.Common.DTOs;
using AFBack.DTOs;
using AFBack.Features.Broadcast.Services.Interfaces;
using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.MessageNotifications.DTOs;
using AFBack.Features.MessageNotifications.Service;
using AFBack.Features.SignalR.Constants;
using AFBack.Features.SignalR.Services;
using AFBack.Features.SyncEvents.Enums;
using AFBack.Features.SyncEvents.Services;


namespace AFBack.Features.Broadcast.Services;

public class ConversationBroadcastService(
    ILogger<ConversationBroadcastService> logger,
    IMessageNotificationService messageNotificationService,
    ISignalRNotificationService signalRNotificationService,
    ISyncService syncService,
    IConversationPresenceService conversationPresenceService) 
    :  IConversationBroadcastService
{
    // ============ 1-1 SAMTALER ============
    
    /// <inheritdoc />
    public async Task BroadcastPendingRequestAcceptedAsync(string acceptingUserId, string senderUserId,
        ConversationResponse response, string notificationSummary, UserSummaryDto senderUserSummary)
    {
        var conversationId = response.Id;
        
        // Sjekker om brukeren er aktive i samtalen og lest notifikasjonen
        var isRead = await conversationPresenceService
            .IsUserInConversationAsync(senderUserId, conversationId);
    
        // Opprett notification til avsender (den som sendte forespørselen)
        MessageNotificationResponse? notification = null;
        try
        {
            notification = await messageNotificationService.CreateConversationAcceptedNotificationAsync(
                senderUserId, acceptingUserId, response, notificationSummary, senderUserSummary, isRead);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create conversation accepted notification for user {UserId}", 
                senderUserId);
        }
    
        // Kjør alle utsendelser parallelt
        await Task.WhenAll(
            // SyncEvent for brukeren som aksepterte
            syncService.CreateSyncEventsAsync(
                [acceptingUserId],
                SyncEventType.ConversationAccepted,
                new
                {
                    Conversation = response,
                    Notification = (MessageNotificationResponse?)null
                }),

            // SignalR til avsender
            signalRNotificationService.SendToUserAsync(
                senderUserId,
                HubConstants.ClientEvents.ConversationAccepted,
                new
                {
                    Conversation = response,
                    Notification = notification
                },
                $"conversation {conversationId} accepted"),

            // SyncEvent for avsender
            syncService.CreateSyncEventsAsync(
                [senderUserId], 
                SyncEventType.ConversationRequestAccepted, 
                new
                {
                    Conversation = response,
                    Notification = notification
                })
        );
    }
    
    /// <inheritdoc />
    public async Task BroadcastPendingRequestRejectedAsync(
        string rejectingUserId,
        int conversationId)
    {
        // SyncEvent kun for brukeren som avviste (sender skal ikke vite)
        await syncService.CreateSyncEventsAsync(
            [rejectingUserId],
            SyncEventType.ConversationRejected,
            conversationId);
    }
    
    /// <inheritdoc />
    public async Task BroadcastNewPendingRequestAsync(
        string senderUserId,
        string receiverUserId,
        SendMessageToUserResponse response)
    {
        // Opprett notification først (ikke tidskritisk som meldinger)
        MessageNotificationResponse? notification = null;
        try
        {
            notification = await messageNotificationService.CreatePendingConversationNotificationAsync(
                receiverUserId, senderUserId, response.Conversation);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create pending conversation notification for user {UserId}", 
                receiverUserId);
        }
    
        // SignalR til mottaker med notification inkludert
        await signalRNotificationService.SendToUserAsync(
            receiverUserId,
            HubConstants.ClientEvents.IncomingPendingRequest,
            new
            {
                Response = response,
                Notification = notification
            },
            $"pending request to user {receiverUserId}");
    
        // SyncEvent for avsender (ingen notification)
        await syncService.CreateSyncEventsAsync(
            [senderUserId],
            SyncEventType.ConversationCreated,
            new
            {
                Response = response,
                Notification = (MessageNotificationResponse?)null
            });
    
        // SyncEvent for mottaker (med notification)
        await syncService.CreateSyncEventsAsync(
            [receiverUserId],
            SyncEventType.PendingConversationCreated,
            new
            {
                Response = response,
                Notification = notification
            });
    }
    
    /// <inheritdoc />
    public async Task BroadcastNewDirectConversationAsync(
        string senderUserId,
        string receiverUserId,
        SendMessageToUserResponse response)
    {
        // Opprett notification til mottaker
        MessageNotificationResponse? notification = null;
        try
        {
            notification = await messageNotificationService.CreateNewMessageNotificationAsync(
                receiverUserId, senderUserId, response.Conversation, response.Message);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create new message notification for user {UserId}", 
                receiverUserId);
        }
    
        // SignalR til mottaker (med notification)
        await signalRNotificationService.SendToUserAsync(
            receiverUserId,
            HubConstants.ClientEvents.IncomingDirectConversation,
            new
            {
                Response = response,
                Notification = notification
            },
            $"direct conversation to user {receiverUserId}");
    
        // SyncEvent for avsender (ingen notification)
        await syncService.CreateSyncEventsAsync(
            [senderUserId],
            SyncEventType.ConversationCreated,
            new
            {
                Response = response,
                Notification = (MessageNotificationResponse?)null
            });
    
        // SyncEvent for mottaker (med notification)
        await syncService.CreateSyncEventsAsync(
            [receiverUserId],
            SyncEventType.ConversationCreated,
            new
            {
                Response = response,
                Notification = notification
            });
    }
    
    // ============ ARKIVERING ============
    
    /// <inheritdoc />
    public async Task BroadcastConversationArchivedAsync(
        string userId,
        int conversationId)
    {
        await syncService.CreateSyncEventsAsync(
            [userId],
            SyncEventType.ConversationArchived,
            conversationId);
    }
    
    /// <inheritdoc />
    public async Task BroadcastConversationRestoredAsync(
        string userId,
        ConversationResponse response)
    {
        await syncService.CreateSyncEventsAsync(
            [userId],
            SyncEventType.ConversationRestored,
            response);
    }
}
