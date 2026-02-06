using AFBack.DTOs;
using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.MessageNotification.Models.Enum;

namespace AFBack.Features.Broadcast.Services;

public interface IGroupConversationBroadcastService
{
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
}
