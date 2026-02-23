

using AFBack.Common.DTOs;
using AFBack.DTOs;
using AFBack.Features.Broadcast.DTOs;
using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.MessageNotifications.DTOs;
using AFBack.Features.MessageNotifications.Models.Enum;
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
    
    // ===================================== Public methods =====================================
    
    /// <inheritdoc />
    public async Task BroadcastGroupInviteAcceptedAsync(string joiningUserId, List<string> otherAcceptedMemberIds,
        ConversationResponse response, string summary, UserSummaryDto joiningUserSummaryDto) 
    {
        await BroadcastToGroupMembersAsync(new GroupBroadcastRecord(
            ActorUserId: joiningUserId,
            RecipientIds: otherAcceptedMemberIds,
            Response: response,
            Summary: summary,
            ActorUserSummaryDto: joiningUserSummaryDto,
            GroupEventType: GroupEventType.MemberAccepted,
            ActorSyncEventType: SyncEventType.GroupInviteAcceptedByMe,
            ActorSyncPayload: response,
            RecipientSyncEventType: SyncEventType.GroupInviteAccepted,
            SignalREvent: HubConstants.ClientEvents.GroupMemberJoined,
            LogContext: $"user {joiningUserId} joining group {response.Id}"));
    }
    
    /// <inheritdoc />
    public async Task BroadcastGroupInviteDeclinedAsync(string decliningUserId, List<string> otherAcceptedMemberIds,
        ConversationResponse response, string summary, UserSummaryDto decliningUserSummaryDto)
    {
        await BroadcastToGroupMembersAsync(new GroupBroadcastRecord(
            ActorUserId: decliningUserId,
            RecipientIds: otherAcceptedMemberIds,
            Response: response,
            Summary: summary,
            ActorUserSummaryDto: decliningUserSummaryDto,
            GroupEventType: GroupEventType.MemberDeclined,
            ActorSyncEventType: SyncEventType.ConversationRejected,
            ActorSyncPayload: response.Id,
            RecipientSyncEventType: SyncEventType.GroupInviteDeclined,
            SignalREvent: HubConstants.ClientEvents.GroupMemberDeclined,
            LogContext: $"user {decliningUserId} declining group {response.Id}"));
    }
    
    /// <inheritdoc />
    public async Task BroadcastGroupMemberLeftAsync(string leavingUserId, List<string> remainingMemberIds,
        ConversationResponse response, string summary, UserSummaryDto leavingUserSummaryDto)
    {
        await BroadcastToGroupMembersAsync(new GroupBroadcastRecord(
            ActorUserId: leavingUserId,
            RecipientIds: remainingMemberIds,
            Response: response,
            Summary: summary,
            ActorUserSummaryDto: leavingUserSummaryDto,
            GroupEventType: GroupEventType.MemberLeft,
            ActorSyncEventType: SyncEventType.ConversationLeft,
            ActorSyncPayload: response.Id,
            RecipientSyncEventType: SyncEventType.GroupMemberLeft,
            SignalREvent: HubConstants.ClientEvents.GroupMemberLeft,
            LogContext: $"user {leavingUserId} leaving group {response.Id}"));
    }
    
    /// <inheritdoc />
    public async Task BroadcastGroupInvitesSentAsync(string inviterUserId, List<string> invitedUserIds, 
        List<string> otherAcceptedMemberIds, ConversationResponse response, string summary,
        UserSummaryDto inviterUserSummaryDto)
    {
        var conversationId = response.Id;
        
        // Varsle eksisterende medlemmer via felles metode
        await BroadcastToGroupMembersAsync(new GroupBroadcastRecord(
            ActorUserId: inviterUserId,
            RecipientIds: otherAcceptedMemberIds,
            Response: response,
            Summary: summary,
            ActorUserSummaryDto: inviterUserSummaryDto,
            GroupEventType: GroupEventType.MemberInvited,
            ActorSyncEventType: SyncEventType.GroupInfoUpdated,
            ActorSyncPayload: response,
            RecipientSyncEventType: SyncEventType.GroupInfoUpdated,
            SignalREvent: HubConstants.ClientEvents.GroupMembersInvited,
            LogContext: $"invites to group {conversationId}"));
        
        // Varsle inviterte brukere med PendingConversation notification (custom logikk)
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
            
            var payload = new BroadcastPayload
            { 
                ConversationResponse = response, 
                MessageNotificationResponse = notification 
            };
            
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
        UserSummaryDto updaterUserSummaryDto,
        GroupEventType eventType)
    {
        await BroadcastToGroupMembersAsync(new GroupBroadcastRecord(
            ActorUserId: updaterUserId,
            RecipientIds: otherParticipantIds,
            Response: response,
            Summary: summary,
            ActorUserSummaryDto: updaterUserSummaryDto,
            GroupEventType: eventType,
            ActorSyncEventType: SyncEventType.GroupInfoUpdated,
            ActorSyncPayload: response,
            RecipientSyncEventType: SyncEventType.GroupInfoUpdated,
            SignalREvent: HubConstants.ClientEvents.GroupInfoUpdated,
            LogContext: $"group {response.Id} update"));
    }
    
    // ===================================== Private helper methods =====================================
    
    /// <summary>
    /// Felles broadcast-logikk for alle gruppekonversasjons-hendelser.
    /// 1. Oppretter SyncEvent for aktøren (den som utførte handlingen)
    /// 2. Henter read status for mottakerne
    /// 3. Oppretter notifications via groupNotificationService
    /// 4. Sender SignalR og SyncEvent til hver mottaker med deres notification
    /// </summary>
    /// <param name="record"></param>
    private async Task BroadcastToGroupMembersAsync(GroupBroadcastRecord record)
    {
        // SyncEvent for aktøren (ingen notification)
        await syncService.CreateSyncEventsAsync([record.ActorUserId], record.ActorSyncEventType, 
            record.ActorSyncPayload);
        
        // Siste bruker som forlater en gruppe skal kun ha syncevent - early return
        if (record.RecipientIds.Count == 0) 
            return;
        
        // Henter om brukerne er aktive i samtalen
        var memberReadStatus = await GetMemberReadStatusAsync(record.Response.Id, 
            record.RecipientIds);
        
        // Opprett notifications for alle mottakere
        var notifications = await groupNotificationService
            .CreateGroupNotificationEventAsync(record.RecipientIds, record.ActorUserSummaryDto, record.Response,
                record.GroupEventType, record.Summary, memberReadStatus);
        
        // Send SignalR og SyncEvent til hver mottaker med deres notification
        var tasks = record.RecipientIds.Select(async memberId =>
        {
            // Henter ut notification - fallback hvis noe galt skjer under opprettelsen av en notifikasjon
            notifications.TryGetValue(memberId, out var notification);
            
            var payload = new BroadcastPayload
            {
                ConversationResponse = record.Response,
                MessageNotificationResponse = notification
            };
            
            await signalRNotificationService.SendToUserAsync(memberId, record.SignalREvent, payload,
                $"{record.LogContext} - member {memberId}");
            
            await syncService.CreateSyncEventsAsync([memberId], record.RecipientSyncEventType, payload);
        });
        
        await Task.WhenAll(tasks);
    }
    
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
