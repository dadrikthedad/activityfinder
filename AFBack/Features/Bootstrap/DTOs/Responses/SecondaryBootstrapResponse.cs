using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.MessageNotifications.DTOs;
using AFBack.Features.Messaging.DTOs.Response;
namespace AFBack.Features.Bootstrap.DTOs.Responses;

public class SecondaryBootstrapResponse
{
    public required List<ConversationResponse> ActiveConversations { get; init; }
    public required List<ConversationResponse> PendingConversations { get; init; }
    public required Dictionary<int, List<MessageResponse>> ConversationMessages { get; init; }
    public required List<MessageNotificationResponse> MessageNotifications { get; init; }
    public int UnreadMessageNotificationCount { get; init; }
    
    public required List<int> UnreadConversationIds { get; init; }
}
