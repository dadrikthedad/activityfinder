using AFBack.Common.DTOs;
using AFBack.Features.Notifications.DTOs.Responses;
using AFBack.Features.Notifications.Enums;
using AFBack.Features.Notifications.Models;
using AFBack.Features.Notifications.Repositories;

namespace AFBack.Features.Notifications.Services;

public class NotificationService(
    ILogger<NotificationService> logger,
    INotificationRepository notificationRepository) : INotificationService
{
    /// <inheritdoc />
    public async Task<NotificationResponse> CreateNotificationAsync(string recipientUserId, string relatedUserId,
        NotificationEventType type, string summary, UserSummaryDto relatedUserSummaryDto)
    {
        logger.LogInformation("Creating {Type} notification for UserId: {RecipientId} from UserId: {RelatedId}",
            type, recipientUserId, relatedUserId);
        
        var notification = new Notification
        {
            RecipientUserId = recipientUserId,
            RelatedUserId = relatedUserId,
            Type = type,
            Summary = summary
        };
        
        await notificationRepository.CreateNotificationAsync(notification);
        
        return new NotificationResponse
        {
            Id = notification.Id,
            Type = notification.Type,
            Summary = notification.Summary,
            IsRead = notification.IsRead,
            CreatedAt = notification.CreatedAt,
            RelatedUserSummaryDto = relatedUserSummaryDto
        };
    }
}
