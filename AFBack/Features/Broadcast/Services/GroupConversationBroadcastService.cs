using AFBack.DTOs;
using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.MessageNotification.Models.Enum;
using AFBack.Features.MessageNotifications.DTOs;
using AFBack.Features.MessageNotifications.Service;
using AFBack.Features.SignalR.Constants;
using AFBack.Features.SignalR.Services;
using AFBack.Features.SyncEvents.Enums;
using AFBack.Features.SyncEvents.Services;


namespace AFBack.Features.Broadcast.Services;

public class GroupConversationBroadcastService(
    ILogger<GroupConversationBroadcastService> logger,
    IMessageNotificationService messageNotificationService,
    IGroupNotificationService groupNotificationService,
    ISyncService syncService,
    ISignalRNotificationService signalRNotificationService,
    IConversationPresenceService conversationPresenceService) : IGroupConversationBroadcastService   
{
    /// <inheritdoc />
    public async Task BroadcastGroupInviteAcceptedAsync(string joiningUserId, List<string> otherAcceptedMemberIds,
        ConversationResponse response, string summary, UserSummaryDto joiningUserSummary) 
    {
        var conversationId = response.Id;
    
        // SyncEvent for brukeren som aksepterte (ingen notification)
        await syncService.CreateSyncEventsAsync(
            [joiningUserId],
            SyncEventType.GroupInviteAcceptedByMe,
            new { Conversation = response, Notification = (MessageNotificationResponse?)null });

    
        // Varsle andre medlemmer
        if (otherAcceptedMemberIds.Count == 0) return;
        
        // Henter om brukerne er aktive i samtalen
        var memberReadStatus = await GetMemberReadStatusAsync(conversationId, otherAcceptedMemberIds);
    
        // Opprett notifications for alle mottakere
        var notifications = await groupNotificationService
            .CreateGroupNotificationEventAsync(otherAcceptedMemberIds, joiningUserSummary, response,
            GroupEventType.MemberAccepted, summary, memberReadStatus);
    
        // Send SignalR og SyncEvent til hver mottaker med deres notification
        var memberTasks = otherAcceptedMemberIds.Select(async memberId =>
        {
            notifications.TryGetValue(memberId, out var notification);
        
            var payload = new { Conversation = response, Notification = notification };
        
            await signalRNotificationService.SendToUserAsync(memberId, 
                HubConstants.ClientEvents.GroupMemberJoined, payload,
                $"member {memberId} about user {joiningUserId} joining group {conversationId}");
        
            await syncService.CreateSyncEventsAsync([memberId], SyncEventType.GroupInviteAccepted, payload);
        });
    
        await Task.WhenAll(memberTasks);
    }
    
     /// <inheritdoc />
     public async Task BroadcastGroupInviteDeclinedAsync(
        string decliningUserId,
        List<string> otherAcceptedMemberIds,
        ConversationResponse response,
        string summary,
        UserSummaryDto decliningUserSummary)
    {
        var conversationId = response.Id;
    
        // SyncEvent for brukeren som avviste
        await syncService.CreateSyncEventsAsync(
            [decliningUserId],
            SyncEventType.ConversationRejected,
            conversationId);
    
        // Varsle andre medlemmer
        if (otherAcceptedMemberIds.Count == 0) return;
        
        // Henter om brukerne er aktive i samtalen
        var memberReadStatus = await GetMemberReadStatusAsync(conversationId, otherAcceptedMemberIds);
    
        // Opprett notifications for alle mottakere
        var notifications = await groupNotificationService
            .CreateGroupNotificationEventAsync(otherAcceptedMemberIds, decliningUserSummary, response,
            GroupEventType.MemberDeclined, summary, memberReadStatus);
    
        // Send SignalR og SyncEvent til hver mottaker
        var memberTasks = otherAcceptedMemberIds.Select(async memberId =>
        {
            notifications.TryGetValue(memberId, out var notification);
            var payload = new { Conversation = response, Notification = notification };
        
            await signalRNotificationService.SendToUserAsync(memberId, HubConstants.ClientEvents.GroupMemberDeclined, payload,
                $"member {memberId} about user {decliningUserId} declining group {conversationId}");
        
            await syncService.CreateSyncEventsAsync([memberId], SyncEventType.GroupInviteDeclined, payload);
        });
    
        await Task.WhenAll(memberTasks);
    }
    
     /// <inheritdoc />
     public async Task BroadcastGroupMemberLeftAsync(string leavingUserId, List<string> remainingMemberIds,
        ConversationResponse response, string summary, UserSummaryDto leavingUserSummary)
    {
        var conversationId = response.Id;
    
        // SyncEvent for brukeren som forlot
        await syncService.CreateSyncEventsAsync(
            [leavingUserId],
            SyncEventType.ConversationLeft,
            conversationId);
    
        // Varsle gjenværende medlemmer
        if (remainingMemberIds.Count == 0) return;
        
        // Henter om brukerne er aktive i samtalen
        var memberReadStatus = await GetMemberReadStatusAsync(conversationId, remainingMemberIds);
    
        // Opprett notifications for alle mottakere
        var notifications = await 
            groupNotificationService.CreateGroupNotificationEventAsync(remainingMemberIds, leavingUserSummary,
            response, GroupEventType.MemberLeft, summary, memberReadStatus);
    
        // Send SignalR og SyncEvent til hver mottaker
        var memberTasks = remainingMemberIds.Select(async memberId =>
        {
            notifications.TryGetValue(memberId, out var notification);
            var payload = new { Conversation = response, Notification = notification };
        
            await signalRNotificationService.SendToUserAsync(memberId, HubConstants.ClientEvents.GroupMemberLeft, payload,
                $"member {memberId} about user {leavingUserId} leaving group {conversationId}");
        
            await syncService.CreateSyncEventsAsync([memberId], SyncEventType.GroupMemberLeft, payload);
        });
    
        await Task.WhenAll(memberTasks);
    }
    
     /// <inheritdoc />
     public async Task BroadcastGroupInvitesSentAsync(string inviterUserId, List<string> invitedUserIds, 
        List<string> otherAcceptedMemberIds, ConversationResponse response, string summary,
        UserSummaryDto inviterUserSummary)
    {
        var conversationId = response.Id;
        
        // SyncEvent for brukeren som inviterte (ingen notification)
        await syncService.CreateSyncEventsAsync(
            [inviterUserId],
            SyncEventType.GroupInfoUpdated,
            new { Conversation = response, Notification = (MessageNotificationResponse?)null });
        
        // Henter om brukerne er aktive i samtalen
        var memberReadStatus = await GetMemberReadStatusAsync(conversationId, otherAcceptedMemberIds);
        
        // Varsle eksisterende medlemmer med GroupEvent notification
        if (otherAcceptedMemberIds.Count > 0)
        {
            var memberNotifications = await 
                groupNotificationService.CreateGroupNotificationEventAsync(otherAcceptedMemberIds, inviterUserSummary,
                response, GroupEventType.MemberInvited, summary, memberReadStatus);
            
            var memberTasks = otherAcceptedMemberIds.Select(async memberId =>
            {
                memberNotifications.TryGetValue(memberId, out var notification);
                var payload = new { Conversation = response, Notification = notification };
                
                await signalRNotificationService.SendToUserAsync(memberId, HubConstants.ClientEvents.GroupMembersInvited, payload,
                    $"member {memberId} about invites to group {conversationId}");
                
                await syncService.CreateSyncEventsAsync([memberId], SyncEventType.GroupInfoUpdated, payload);
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
            
            await signalRNotificationService.SendToUserAsync(receiverId, 
                HubConstants.ClientEvents.GroupInviteReceived, payload,
                $"invited user {receiverId} for group {conversationId}");
            
            await syncService.CreateSyncEventsAsync([receiverId], SyncEventType.GroupInviteReceived, 
                payload);
        });
        
        await Task.WhenAll(inviteTasks);
    }
    
     /// <inheritdoc />
     public async Task BroadcastGroupInfoUpdatedAsync(
        string updaterUserId,
        List<string> otherParticipantIds,
        ConversationResponse response,
        string summary,
        UserSummaryDto updaterUserSummary,
        GroupEventType eventType,
        string signalREventName = HubConstants.ClientEvents.GroupInfoUpdated)
    {
        var conversationId = response.Id;
    
        // SyncEvent for brukeren som oppdaterte (ingen notification)
        await syncService.CreateSyncEventsAsync(
            [updaterUserId],
            SyncEventType.GroupInfoUpdated,
            new { Conversation = response, Notification = (MessageNotificationResponse?)null });
    
        // Varsle andre deltakere
        if (otherParticipantIds.Count == 0) return;
        
        // Henter om brukerne er aktive i samtalen
        var memberReadStatus = await GetMemberReadStatusAsync(conversationId, otherParticipantIds);
    
        // Opprett notifications for alle mottakere
        var notifications = await groupNotificationService
            .CreateGroupNotificationEventAsync(otherParticipantIds, updaterUserSummary, response, eventType,
            summary, memberReadStatus);
    
        // Send SignalR og SyncEvent til hver mottaker
        var participantTasks = otherParticipantIds.Select(async participantId =>
        {
            notifications.TryGetValue(participantId, out var notification);
            var payload = new { Conversation = response, Notification = notification };
        
            await signalRNotificationService.SendToUserAsync(participantId, signalREventName, payload,
                $"participant {participantId} about group {conversationId} update");
        
            await syncService.CreateSyncEventsAsync([participantId], 
                SyncEventType.GroupInfoUpdated, payload);
        });
    
        await Task.WhenAll(participantTasks);
    }
     // ===================================== Private helper methods =====================================
     
     /// <summary>
     /// Henter om en bruker er aktive i samtalen for øyeblikket og setter en notification som lest
     /// </summary>
     /// <param name="conversationId">Samtalen som sjekkes</param>
     /// <param name="memberIds">Brukerne som sjekkes</param>
     /// <returns>En Dictionary med Key = brukerId, Value = bool med true i samtalen, false hvis ikke</returns>
    private async Task<Dictionary<string, bool>> GetMemberReadStatusAsync(int conversationId, List<string> memberIds)
    {
        var activeUsers = await conversationPresenceService
            .GetActiveUsersInConversationAsync(conversationId);
        var activeUserSet = activeUsers.ToHashSet();

        return memberIds.ToDictionary(id => id, id => activeUserSet.Contains(id));
    }
}
