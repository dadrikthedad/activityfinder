using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.MessageNotifications.DTOs;
using AFBack.Features.Messaging.DTOs.Response;
using AFBack.Features.Reactions.Enums;

namespace AFBack.Features.Broadcast.DTOs;

public record ReactionUpdatedBroadcastPayload
{
    public ReactionAction ReactionAction { get; init; }
    public ConversationResponse ConversationResponse { get; init; } = null!;
    public MessageResponse MessageResponse { get; init; } = null!;
    public MessageNotificationResponse? MessageNotificationResponse { get; init; }
}
