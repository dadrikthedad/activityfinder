using AFBack.DTOs;
using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.MessageNotification.DTOs;
using AFBack.Features.MessageNotification.Models.Enum;
using AFBack.Features.MessageNotification.Service;
using AFBack.Features.SyncEvents.Enums;
using AFBack.Features.SyncEvents.Services;
using AFBack.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace AFBack.Features.Broadcast.Services;

public class ConversationBroadcastService(
    ILogger<ConversationBroadcastService> logger,
    IHubContext<UserHub> hubContext,
    IMessageNotificationService messageNotificationService,
    IGroupNotificationService groupNotificationService,
    ISyncService syncService) : IConversationBroadcastService
{
    // ============ 1-1 SAMTALER ============
    
    // Sjekk interface for summary
    public async Task BroadcastPendingRequestAcceptedAsync(string acceptingUserId, string senderUserId,
        ConversationResponse response, string notificationSummary, UserSummaryDto senderUserSummary)
    {
        var conversationId = response.Id;
    
        // Opprett notification til avsender (den som sendte forespørselen)
        MessageNotificationResponse? notification = null;
        try
        {
            notification = await messageNotificationService.CreateConversationAcceptedNotificationAsync(
                senderUserId, acceptingUserId, response, notificationSummary, senderUserSummary);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create conversation accepted notification for user {UserId}", 
                senderUserId);
        }
    
        // SyncEvent for brukeren som aksepterte (til andre enheter, ingen notification)
        await TrySyncAsync(
            [acceptingUserId],
            SyncEventType.ConversationAccepted,
            new
            {
                Conversation = response,
                Notification = (MessageNotificationResponse?)null
            },
            $"accepted conversation {conversationId}");
    
        // SignalR til avsender (den som sendte forespørselen, med notification)
        await TrySignalRAsync(
            senderUserId,
            "ConversationAccepted",
            new
            {
                Conversation = response,
                Notification = notification
            },
            $"conversation {conversationId} accepted");
    
        // SyncEvent for avsender (med notification)
        await TrySyncAsync([senderUserId], SyncEventType.ConversationRequestAccepted, 
            new
            {
                Conversation = response,
                Notification = notification
            },
            $"conversation {conversationId} request accepted");
    }
    
    // Sjekk interface for summary
    public async Task BroadcastPendingRequestRejectedAsync(
        string rejectingUserId,
        int conversationId)
    {
        // SyncEvent kun for brukeren som avviste (sender skal ikke vite)
        await TrySyncAsync(
            [rejectingUserId],
            SyncEventType.ConversationRejected,
            conversationId,
            $"rejected conversation {conversationId}");
    }
    
    // Sjekk interface for summary
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
        await TrySignalRAsync(
            receiverUserId,
            "IncomingPendingRequest",
            new
            {
                Response = response,
                Notification = notification
            },
            $"pending request to user {receiverUserId}");
    
        // SyncEvent for avsender (ingen notification)
        await TrySyncAsync(
            [senderUserId],
            SyncEventType.ConversationCreated,
            new
            {
                Response = response,
                Notification = (MessageNotificationResponse?)null
            },
            $"conversation {response.ConversationId} created by sender");
    
        // SyncEvent for mottaker (med notification)
        await TrySyncAsync(
            [receiverUserId],
            SyncEventType.PendingConversationCreated,
            new
            {
                Response = response,
                Notification = notification
            },
            $"pending conversation {response.ConversationId} for receiver");
    }
    
    // Sjekk interface for summary
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
        await TrySignalRAsync(
            receiverUserId,
            "IncomingDirectConversation",
            new
            {
                Response = response,
                Notification = notification
            },
            $"direct conversation to user {receiverUserId}");
    
        // SyncEvent for avsender (ingen notification)
        await TrySyncAsync(
            [senderUserId],
            SyncEventType.ConversationCreated,
            new
            {
                Response = response,
                Notification = (MessageNotificationResponse?)null
            },
            $"conversation {response.ConversationId} created by sender");
    
        // SyncEvent for mottaker (med notification)
        await TrySyncAsync(
            [receiverUserId],
            SyncEventType.ConversationCreated,
            new
            {
                Response = response,
                Notification = notification
            },
            $"conversation {response.ConversationId} for receiver");
    }
    
    // ============ GRUPPE-SAMTALER ============
    
    // Sjekk interface for summary
    public async Task BroadcastGroupInviteAcceptedAsync(string joiningUserId, List<string> otherAcceptedMemberIds,
        ConversationResponse response, string summary, UserSummaryDto joiningUserSummary) 
    {
        var conversationId = response.Id;
    
        // SyncEvent for brukeren som aksepterte (ingen notification)
        await TrySyncAsync(
            [joiningUserId],
            SyncEventType.GroupInviteAcceptedByMe,
            new { Conversation = response, Notification = (MessageNotificationResponse?)null },
            $"user {joiningUserId} accepted group {conversationId}");
    
        // Varsle andre medlemmer
        if (otherAcceptedMemberIds.Count == 0) return;
    
        // Opprett notifications for alle mottakere
        var notifications = await groupNotificationService
            .CreateGroupNotificationEventAsync(otherAcceptedMemberIds, joiningUserSummary, response,
            GroupEventType.MemberAccepted, summary);
    
        // Send SignalR og SyncEvent til hver mottaker med deres notification
        var memberTasks = otherAcceptedMemberIds.Select(async memberId =>
        {
            notifications.TryGetValue(memberId, out var notification);
        
            var payload = new { Conversation = response, Notification = notification };
        
            await TrySignalRAsync(memberId, "GroupMemberJoined", payload,
                $"member {memberId} about user {joiningUserId} joining group {conversationId}");
        
            await TrySyncAsync([memberId], SyncEventType.GroupInviteAccepted, payload,
                $"sync for member {memberId}");
        });
    
        await Task.WhenAll(memberTasks);
    }
    
    // Sjekk interface for summary
    public async Task BroadcastGroupInviteDeclinedAsync(
        string decliningUserId,
        List<string> otherAcceptedMemberIds,
        ConversationResponse response,
        string summary,
        UserSummaryDto decliningUserSummary)
    {
        var conversationId = response.Id;
    
        // SyncEvent for brukeren som avviste
        await TrySyncAsync(
            [decliningUserId],
            SyncEventType.ConversationRejected,
            conversationId,
            $"user {decliningUserId} declined group {conversationId}");
    
        // Varsle andre medlemmer
        if (otherAcceptedMemberIds.Count == 0) return;
    
        // Opprett notifications for alle mottakere
        var notifications = await groupNotificationService
            .CreateGroupNotificationEventAsync(otherAcceptedMemberIds, decliningUserSummary, response,
            GroupEventType.MemberDeclined, summary);
    
        // Send SignalR og SyncEvent til hver mottaker
        var memberTasks = otherAcceptedMemberIds.Select(async memberId =>
        {
            notifications.TryGetValue(memberId, out var notification);
            var payload = new { Conversation = response, Notification = notification };
        
            await TrySignalRAsync(memberId, "GroupMemberDeclined", payload,
                $"member {memberId} about user {decliningUserId} declining group {conversationId}");
        
            await TrySyncAsync([memberId], SyncEventType.GroupInviteDeclined, payload,
                $"sync for member {memberId}");
        });
    
        await Task.WhenAll(memberTasks);
    }
    
    // Sjekk interface for summary
    public async Task BroadcastGroupMemberLeftAsync(string leavingUserId, List<string> remainingMemberIds,
        ConversationResponse response, string summary, UserSummaryDto leavingUserSummary)
    {
        var conversationId = response.Id;
    
        // SyncEvent for brukeren som forlot
        await TrySyncAsync(
            [leavingUserId],
            SyncEventType.ConversationLeft,
            conversationId,
            $"user {leavingUserId} left group {conversationId}");
    
        // Varsle gjenværende medlemmer
        if (remainingMemberIds.Count == 0) return;
    
        // Opprett notifications for alle mottakere
        var notifications = await 
            groupNotificationService.CreateGroupNotificationEventAsync(remainingMemberIds, leavingUserSummary,
            response, GroupEventType.MemberLeft, summary);
    
        // Send SignalR og SyncEvent til hver mottaker
        var memberTasks = remainingMemberIds.Select(async memberId =>
        {
            notifications.TryGetValue(memberId, out var notification);
            var payload = new { Conversation = response, Notification = notification };
        
            await TrySignalRAsync(memberId, "GroupMemberLeft", payload,
                $"member {memberId} about user {leavingUserId} leaving group {conversationId}");
        
            await TrySyncAsync([memberId], SyncEventType.GroupMemberLeft, payload,
                $"sync for member {memberId}");
        });
    
        await Task.WhenAll(memberTasks);
    }
    
    // Sjekk interface for summary
    public async Task BroadcastGroupInvitesSentAsync(string inviterUserId, List<string> invitedUserIds, 
        List<string> otherAcceptedMemberIds, ConversationResponse response, string summary,
        UserSummaryDto inviterUserSummary)
    {
        var conversationId = response.Id;
        
        // SyncEvent for brukeren som inviterte (ingen notification)
        await TrySyncAsync(
            [inviterUserId],
            SyncEventType.GroupInfoUpdated,
            new { Conversation = response, Notification = (MessageNotificationResponse?)null },
            $"inviter {inviterUserId} for group {conversationId}");
        
        // Varsle eksisterende medlemmer med GroupEvent notification
        if (otherAcceptedMemberIds.Count > 0)
        {
            var memberNotifications = await 
                groupNotificationService.CreateGroupNotificationEventAsync(otherAcceptedMemberIds, inviterUserSummary,
                response, GroupEventType.MemberInvited, summary);
            
            var memberTasks = otherAcceptedMemberIds.Select(async memberId =>
            {
                memberNotifications.TryGetValue(memberId, out var notification);
                var payload = new { Conversation = response, Notification = notification };
                
                await TrySignalRAsync(memberId, "GroupMembersInvited", payload,
                    $"member {memberId} about invites to group {conversationId}");
                
                await TrySyncAsync([memberId], SyncEventType.GroupInfoUpdated, payload,
                    $"sync for member {memberId}");
            });
            
            await Task.WhenAll(memberTasks);
        }
        
        // Varsle inviterte brukere med PendingConversation notification
        var inviteTasks = invitedUserIds.Select(async receiverId =>
        {
            MessageNotificationResponse? notification = null;
            try
            {
                notification = await messageNotificationService.CreatePendingConversationNotificationAsync(
                    receiverId, inviterUserId, response);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to create pending notification for user {UserId}", receiverId);
            }
            
            var payload = new { Conversation = response, Notification = notification };
            
            await TrySignalRAsync(receiverId, "GroupInviteReceived", payload,
                $"invited user {receiverId} for group {conversationId}");
            
            await TrySyncAsync([receiverId], SyncEventType.GroupInviteReceived, payload,
                $"sync for invited user {receiverId}");
        });
        
        await Task.WhenAll(inviteTasks);
    }
    
    // Sjekk interface for summary
    public async Task BroadcastGroupInfoUpdatedAsync(
        string updaterUserId,
        List<string> otherParticipantIds,
        ConversationResponse response,
        string summary,
        UserSummaryDto updaterUserSummary,
        GroupEventType eventType,
        string signalREventName = "GroupInfoUpdated")
    {
        var conversationId = response.Id;
    
        // SyncEvent for brukeren som oppdaterte (ingen notification)
        await TrySyncAsync(
            [updaterUserId],
            SyncEventType.GroupInfoUpdated,
            new { Conversation = response, Notification = (MessageNotificationResponse?)null },
            $"updater {updaterUserId} for group {conversationId}");
    
        // Varsle andre deltakere
        if (otherParticipantIds.Count == 0) return;
    
        // Opprett notifications for alle mottakere
        var notifications = await groupNotificationService.CreateGroupNotificationEventAsync(
            otherParticipantIds,
            updaterUserSummary,
            response,
            eventType,
            summary);
    
        // Send SignalR og SyncEvent til hver mottaker
        var participantTasks = otherParticipantIds.Select(async participantId =>
        {
            notifications.TryGetValue(participantId, out var notification);
            var payload = new { Conversation = response, Notification = notification };
        
            await TrySignalRAsync(participantId, signalREventName, payload,
                $"participant {participantId} about group {conversationId} update");
        
            await TrySyncAsync([participantId], SyncEventType.GroupInfoUpdated, payload,
                $"sync for participant {participantId}");
        });
    
        await Task.WhenAll(participantTasks);
    }
    
    // ============ ARKIVERING ============
    
    // Sjekk interface for summary
    public async Task BroadcastConversationArchivedAsync(
        string userId,
        int conversationId)
    {
        await TrySyncAsync(
            [userId],
            SyncEventType.ConversationArchived,
            conversationId,
            $"user {userId} archived conversation {conversationId}");
    }
    
    // Sjekk interface for summary
    public async Task BroadcastConversationRestoredAsync(
        string userId,
        ConversationResponse response)
    {
        await TrySyncAsync(
            [userId],
            SyncEventType.ConversationRestored,
            response,
            $"user {userId} restored conversation {response.Id}");
    }
    
    // ============ PRIVATE HJELPEMETODER ============
    
    
    /// <summary>
    /// Sender SignalR med feilhåndtering.
    /// </summary>
    private async Task TrySignalRAsync(string userId, string eventName, object payload, string methodCallerContext)
    {
        try
        {
            await hubContext.Clients.User(userId).SendAsync(eventName, payload);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send SignalR '{EventName}' for {Context}", 
                eventName, methodCallerContext);
        }
    }
    
    /// <summary>
    /// Oppretter SyncEvent med feilhåndtering.
    /// </summary>
    private async Task TrySyncAsync(List<string> userIds, SyncEventType eventType, object payload, 
        string methodCallerContext)
    {
        try
        {
            await syncService.CreateSyncEventsAsync(userIds, eventType, payload);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create SyncEvent '{EventType}' for {Context}", 
                eventType, methodCallerContext);
        }
    }
}
