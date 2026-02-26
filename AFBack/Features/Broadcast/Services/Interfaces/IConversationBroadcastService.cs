using AFBack.Common.DTOs;
using AFBack.Features.Conversation.DTOs.Response;

namespace AFBack.Features.Broadcast.Services.Interfaces;

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
