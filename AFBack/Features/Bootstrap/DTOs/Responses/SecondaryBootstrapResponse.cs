using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.Friendship.DTOs.Responses;
using AFBack.Features.MessageNotifications.DTOs;
using AFBack.Features.Messaging.DTOs.Response;
using AFBack.Features.Notifications.DTOs.Responses;

namespace AFBack.Features.Bootstrap.DTOs.Responses;

// SecondaryBootstrapResponse.cs
public class SecondaryBootstrapResponse
{
    public required List<ConversationResponse> ActiveConversations { get; init; }
    public required List<ConversationResponse> PendingConversations { get; init; }
    public required Dictionary<int, List<MessageResponse>> ConversationMessages { get; init; }
    public required List<MessageNotificationResponse> MessageNotifications { get; init; }
    public required List<NotificationResponse> Notifications { get; init; }
    public required List<PendingFriendshipRequestResponse> PendingFriendshipRequests { get; init; }
    public int UnreadMessageNotificationCount { get; init; }
    public int UnreadNotificationCount { get; init; }
    
    public required List<int> UnreadConversationIds { get; init; }
}
