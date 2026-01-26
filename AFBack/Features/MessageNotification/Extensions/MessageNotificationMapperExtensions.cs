using AFBack.DTOs;
using AFBack.Features.Conversation.DTOs;
using AFBack.Features.MessageNotification.DTOs;

namespace AFBack.Features.MessageNotification.Extensions;

public static class MessageNotificationMapperExtensions
{
    /// <summary>
    /// Mapper en MessageNotification til en MessageNotificationResponse med sender info og samtale detaljer
    /// </summary>
    /// <param name="notification">Notifikasjon-entiteten</param>
    /// <param name="senderUserSummary">Avsender brukerinfo</param>
    /// <param name="preview">Preview tekst for notifikasjonen</param>
    /// <param name="groupName">Gruppenavn (null for 1-1 samtaler)</param>
    /// <param name="groupImageUrl">Gruppe bilde URL (null for 1-1 samtaler)</param>
    /// <returns>MessageNotificationResponse</returns>
    public static MessageNotificationResponse ToResponse(this Models.MessageNotification notification,
        UserSummaryDto senderUserSummary,
        string preview,
        string? groupName = null,
        string? groupImageUrl = null) => 
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
            SenderUserSummary = senderUserSummary,
            GroupName = groupName,
            GroupImageUrl = groupImageUrl
        };
}
