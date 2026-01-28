using AFBack.DTOs;
using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.MessageNotification.Models.Enum;

namespace AFBack.Features.Broadcast.Services;

public interface IConversationBroadcastService
{
    // ============ 1-1 SAMTALER ============

    /// <summary>
    /// Broadcaster at en 1-1 samtaleforespørsel ble akseptert.
    /// Oppretter notification, deretter sender SignalR og SyncEvent med notification inkludert.
    /// Sender til: aksepterende bruker (sync uten notification), avsender (SignalR + sync med notification)
    /// </summary>
    Task BroadcastPendingRequestAcceptedAsync(string acceptingUserId, string senderUserId,
        ConversationResponse response, string notificationSummary, UserSummaryDto senderUserSummary);
    
    /// <summary>
    /// Broadcaster at en 1-1 samtaleforespørsel ble avvist.
    /// Sender kun til: avvisende bruker (sync til andre enheter)
    /// </summary>
    Task BroadcastPendingRequestRejectedAsync(
        string rejectingUserId,
        int conversationId);
    
    /// <summary>
    /// Broadcaster at en ny 1-1 samtale (PendingRequest) ble opprettet.
    /// Oppretter notification, deretter sender SignalR og SyncEvent med notification inkludert.
    /// Sender til: avsender (sync uten notification), mottaker (SignalR + sync med notification)
    /// </summary>
    Task BroadcastNewPendingRequestAsync(string senderUserId, string receiverUserId, 
        SendMessageToUserResponse response);
    
    /// <summary>
    /// Broadcaster at en ny 1-1 samtale (DirectChat - venner) ble opprettet.
    /// Oppretter notification, deretter sender SignalR og SyncEvent med notification inkludert.
    /// Sender til: avsender (sync uten notification), mottaker (SignalR + sync med notification)
    /// </summary>
    Task BroadcastNewDirectConversationAsync(
        string senderUserId,
        string receiverUserId,
        SendMessageToUserResponse response);
    
    // ============ GRUPPE-SAMTALER ============

    /// <summary>
    /// Broadcaster at en bruker aksepterte en gruppeinvitasjon.
    /// Sender til: aksepterende bruker (sync), andre medlemmer (SignalR + notification + sync)
    /// </summary>
    Task BroadcastGroupInviteAcceptedAsync(string joiningUserId, List<string> otherAcceptedMemberIds,
        ConversationResponse response, string summary, UserSummaryDto joiningUserSummary);
    
    /// <summary>
    /// Broadcaster at en bruker avviste en gruppeinvitasjon.
    /// Sender til: avvisende bruker (sync), andre medlemmer (SignalR + sync)
    /// </summary>
    Task BroadcastGroupInviteDeclinedAsync(string decliningUserId, List<string> otherAcceptedMemberIds,
        ConversationResponse response, string summary, UserSummaryDto decliningUserSummary);
    
    /// <summary>
    /// Broadcaster at en bruker forlot en gruppe.
    /// Sender til: brukeren som forlot (sync), gjenværende medlemmer (SignalR + sync)
    /// </summary>
    Task BroadcastGroupMemberLeftAsync(string leavingUserId, List<string> remainingMemberIds, 
        ConversationResponse response, string summary, UserSummaryDto leavingUserSummary);
    
    /// <summary>
    /// Broadcaster at nye brukere ble invitert til en gruppe.
    /// Sender til: inviterende bruker (sync), eksisterende medlemmer (SignalR + sync), inviterte
    /// (SignalR + notification + sync)
    /// </summary>
    Task BroadcastGroupInvitesSentAsync(string inviterUserId, List<string> invitedUserIds,
        List<string> otherAcceptedMemberIds, ConversationResponse response, string summary,
        UserSummaryDto inviterUserSummary);
    
    /// <summary>
    /// Broadcaster at gruppeinformasjon ble oppdatert (navn, bilde, etc).
    /// Sender til: brukeren som oppdaterte (sync), andre deltakere (SignalR + sync)
    /// </summary>
    Task BroadcastGroupInfoUpdatedAsync(string updaterUserId, List<string> otherParticipantIds,
        ConversationResponse response, string summary, UserSummaryDto updaterUserSummary, GroupEventType eventType,
        string signalREventName = "GroupInfoUpdated");
    
    // ============ ARKIVERING ============
    
    /// <summary>
    /// Broadcaster at en samtale ble arkivert.
    /// Sender kun til: brukeren som arkiverte (sync til andre enheter)
    /// </summary>
    Task BroadcastConversationArchivedAsync(
        string userId,
        int conversationId);
    
    /// <summary>
    /// Broadcaster at en arkivert samtale ble gjenopprettet.
    /// Sender kun til: brukeren som gjenopprettet (sync til andre enheter)
    /// </summary>
    Task BroadcastConversationRestoredAsync(
        string userId,
        ConversationResponse response);
}
