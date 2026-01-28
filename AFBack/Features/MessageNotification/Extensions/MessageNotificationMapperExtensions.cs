using AFBack.DTOs;
using AFBack.Features.Conversation.DTOs;
using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.MessageNotification.DTOs;
using AFBack.Features.MessageNotification.Models;

namespace AFBack.Features.MessageNotification.Extensions;

public static class MessageNotificationMapperExtensions
{
    /// <summary>
    /// Mapper en MessageNotification til en MessageNotificationResponse med sender info og samtale detaljer
    /// </summary>
    /// <param name="notification">Notifikasjon-entiteten</param>
    /// <param name="senderUserDto">Avsender brukerinfo</param>
    /// <param name="groupName">Gruppenavn (null for 1-1 samtaler)</param>
    /// <param name="groupImageUrl">Gruppe bilde URL (null for 1-1 samtaler)</param>
    /// <returns>MessageNotificationResponse</returns>
    public static MessageNotificationResponse ToResponse(this Models.MessageNotification notification,
        UserSummaryDto senderUserDto, string? groupName = null, string? groupImageUrl = null) => new()
        {
            Id = notification.Id,
            ConversationId = notification.ConversationId,
            Type = notification.Type,
            CreatedAt = notification.CreatedAt,
            LastUpdatedAt = notification.LastUpdatedAt,
            MessageId = notification.MessageId,
            Summary = notification.Summary,
            MessageCount = notification.MessageCount,
            SenderUserDto = senderUserDto,
            GroupName = groupName,
            GroupImageUrl = groupImageUrl
        };
    
    public static MessageNotificationResponse ToGroupResponse(
        this Models.MessageNotification notification, List<GroupEvent> allEvents, ConversationResponse conversation,
        UserSummaryDto triggeredByUser) => new()
        {
            Id = notification.Id,
            Type = notification.Type,
            ConversationId = notification.ConversationId,
            EventCount = notification.EventCount,
            Summary = notification.Summary,
            CreatedAt = notification.CreatedAt,
            LastUpdatedAt = notification.LastUpdatedAt,
            GroupName = conversation.GroupName,
            GroupImageUrl = conversation.GroupImageUrl,
            IsRead = notification.IsRead,
            SenderUserDto = triggeredByUser,
            LatestGroupEventType = allEvents.LastOrDefault()?.EventType.ToString(),
            GroupEvents = allEvents.Select(e => new GroupEventResponse
            {
                Id = e.Id,
                Type = e.EventType,
                Summary = e.Summary,
                CreatedAt = e.CreatedAt
            }).ToList()
        };
    
}
