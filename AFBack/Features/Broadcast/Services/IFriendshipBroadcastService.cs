using AFBack.Common.DTOs;
using AFBack.Features.Friendship.DTOs.Responses;

namespace AFBack.Features.Broadcast.Services;

public interface IFriendshipBroadcastService
{
    /// <summary>
    /// Broadcaster at en venneforespørsel ble sendt.
    /// Oppretter notification til mottaker, deretter sender SignalR og SyncEvent.
    /// Sender til: mottaker (SignalR + SyncEvent med notification)
    /// </summary>
    /// <param name="senderId">Brukeren som sender forespørselen</param>
    /// <param name="receiverId">Brukeren som mottar forespørselen</param>
    /// <param name="friendshipRequestId">ID-en til den opprettede forespørselen</param>
    /// <param name="sentAt">Tidspunktet forespørselen ble sendt</param>
    /// <param name="senderSummary">UserSummaryDto til avsender</param>
    Task BroadcastFriendshipRequestSentAsync(string senderId, string receiverId,
        int friendshipRequestId, DateTime sentAt, UserSummaryDto senderSummary);

    /// <summary>
    /// Broadcaster at en venneforespørsel ble akseptert.
    /// Oppretter notification til avsender av forespørselen, deretter sender SignalR og SyncEvent til begge.
    /// Sender til: avsender (SignalR + SyncEvent med notification), godkjenner (SyncEvent uten notification)
    /// </summary>
    /// <param name="accepterId">Brukeren som godkjenner forespørselen</param>
    /// <param name="senderId">Brukeren som sendte forespørselen</param>
    /// <param name="requestId">ID-en til forespørselen</param>
    /// <param name="accepterSummary">UserSummaryDto til godkjenner</param>
    /// <param name="senderSummary">UserSummaryDto til avsender</param>
    Task BroadcastFriendshipRequestAcceptedAsync(string accepterId, string senderId,
        int requestId, UserSummaryDto accepterSummary, UserSummaryDto senderSummary);
    
    /// <summary>
    /// Broadcaster at en venneforespørsel ble avslått.
    /// Sender kun SyncEvent til avslående brukers andre enheter.
    /// Avsender av forespørselen får IKKE beskjed (privacy).
    /// </summary>
    /// <param name="userId">Brukeren som avslår</param>
    /// <param name="requestId">ID-en til forespørselen som avslås</param>
    Task BroadcastFriendshipRequestDeclinedAsync(string userId, int requestId);
}
