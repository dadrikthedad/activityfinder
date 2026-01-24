using AFBack.Features.Conversation.DTOs;
using AFBack.Features.MessageNotification.DTOs;
using AFBack.Features.Messaging.DTOs.Response;

namespace AFBack.Features.MessageNotification.Extensions;

public static class MessageNotificationMapperExtensions
{
    public static MessageNotificationResponse ToResponse(this Models.MessageNotification notification,
        ConversationResponse conversationResponse,
        MessageResponse messageResponse,
        string preview) => 
            new()
            {
                Id = notification.Id,
                ConversationId = notification.ConversationId,
                Type = notification.Type,
                CreatedAt = notification.CreatedAt,
                LastUpdatedAt = notification.LastUpdatedAt,
                MessageId = notification.MessageId,
                MessagePreview = preview,
                MessageCount = notification.MessageCount,
                SenderUserSummary = messageResponse.Sender!,
                GroupName = conversationResponse.GroupName,
                GroupImageUrl = conversationResponse.GroupImageUrl
            };
}
