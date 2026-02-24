using AFBack.Common.DTOs;
using AFBack.Features.Friendship.DTOs.Responses;
using AFBack.Features.Notifications.Enums;
using AFBack.Features.Notifications.Services;
using AFBack.Features.SignalR.Constants;
using AFBack.Features.SignalR.Services;
using AFBack.Features.SyncEvents.Enums;
using AFBack.Features.SyncEvents.Services;

namespace AFBack.Features.Broadcast.Services;

public class FriendshipBroadcastService(
    INotificationService notificationService,
    ISignalRNotificationService signalRNotificationService,
    ISyncService syncService) : IFriendshipBroadcastService
{
    /// <inheritdoc />
    public async Task BroadcastFriendshipRequestSentAsync(string senderId, string receiverId,
        int friendshipRequestId, DateTime sentAt, UserSummaryDto senderSummary)
    {
        // Opprett notification til mottaker
        var summary = $"{senderSummary.FullName} wants to be your friend";
        var notificationResponse = await notificationService.CreateNotificationAsync(receiverId, senderId, 
            NotificationEventType.FriendshipRequestReceived, summary, senderSummary);

        var response = new FriendshipRequestResponse
        {
            Id = friendshipRequestId,
            Sender = senderSummary,
            SentAt = sentAt,
            NotificationResponse = notificationResponse
        };

        // SignalR og SyncEvent til mottaker
        await Task.WhenAll(
            signalRNotificationService.SendToUsersAsync([receiverId],
                HubConstants.ClientEvents.FriendshipRequestReceived, response,
                $"Friendship request sent from User {senderId} to User {receiverId}"),

            syncService.CreateSyncEventsAsync([receiverId],
                SyncEventType.FriendshipRequestReceived, response)
        );
    }

    /// <inheritdoc />
    public async Task BroadcastFriendshipRequestAcceptedAsync(string accepterId, string senderId,
        int requestId, UserSummaryDto accepterSummary, UserSummaryDto senderSummary)
    {
        // Opprett notification til avsender av forespørselen
        var summary = $"{accepterSummary.FullName} has accepted your friend request";
        var notificationResponse = await notificationService.CreateNotificationAsync(senderId, accepterId, 
            NotificationEventType.FriendshipRequestAccepted, summary, accepterSummary);

        // Response til avsender (med notification)
        var responseForSender = new FriendshipAcceptedResponse
        {
            Friend = accepterSummary,
            NotificationResponse = notificationResponse
        };

        // Response til godkjenner (uten notification)
        var responseForAccepter = new FriendshipAcceptedResponse
        {
            Friend = senderSummary
        };

        // SignalR og SyncEvent til begge parter
        await Task.WhenAll(
            // SignalR til avsender
            signalRNotificationService.SendToUsersAsync([senderId],
                HubConstants.ClientEvents.FriendshipRequestAccepted, responseForSender,
                $"Friendship request {requestId} accepted by User {accepterId}"),

            // SyncEvent til avsender (med notification)
            syncService.CreateSyncEventsAsync([senderId],
                SyncEventType.FriendshipRequestAccepted, responseForSender),

            // SyncEvent til godkjenner (uten notification)
            syncService.CreateSyncEventsAsync([accepterId],
                SyncEventType.FriendshipRequestAccepted, responseForAccepter)
        );
    }
    
    /// <inheritdoc />
    public async Task BroadcastFriendshipRequestDeclinedAsync(string userId, int requestId) =>
        await syncService.CreateSyncEventsAsync(
            [userId],
            SyncEventType.FriendRequestDeclined,
            requestId);
    
}
