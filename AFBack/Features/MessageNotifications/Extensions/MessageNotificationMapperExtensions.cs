using AFBack.Common.DTOs;
using AFBack.Features.MessageNotification.Models;
using AFBack.Features.MessageNotifications.DTOs;
using AFBack.Features.MessageNotifications.Models;

namespace AFBack.Features.MessageNotifications.Extensions;

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
    public static MessageNotificationResponse ToResponse(this MessageNotifications.Models.MessageNotification notification,
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
    
    /// <summary>
    /// Mapper en MessageNotification til en MessageNotificationResponse for gruppe-hendelser
    /// </summary>
    /// <param name="notification">Notifikasjon-entiteten</param>
    /// <param name="allEvents">Liste over gruppe-hendelser tilknyttet notifikasjonen</param>
    /// <param name="triggeredByUser">Brukeren som utløste den siste hendelsen</param>
    /// <param name="groupName">Gruppenavn (null for 1-1 samtaler)</param>
    /// <param name="groupImageUrl">Gruppe bilde URL (null for 1-1 samtaler)</param>
    /// <returns>MessageNotificationResponse med gruppe-hendelser</returns>
    public static MessageNotificationResponse ToGroupResponse(
        this MessageNotifications.Models.MessageNotification notification, List<GroupEvent> allEvents, UserSummaryDto triggeredByUser, 
        string? groupName = null, string? groupImageUrl = null) => new()
        {
            Id = notification.Id,
            Type = notification.Type,
            ConversationId = notification.ConversationId,
            EventCount = notification.EventCount,
            Summary = notification.Summary,
            CreatedAt = notification.CreatedAt,
            LastUpdatedAt = notification.LastUpdatedAt,
            GroupName = groupName,
            GroupImageUrl = groupImageUrl,
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
