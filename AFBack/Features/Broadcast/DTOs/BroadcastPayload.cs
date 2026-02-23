using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.MessageNotifications.DTOs;

namespace AFBack.Features.Broadcast.DTOs;

public class BroadcastPayload
{
    public ConversationResponse ConversationResponse { get; set; } = null!;
    public MessageNotificationResponse? MessageNotificationResponse { get; set; }
}
