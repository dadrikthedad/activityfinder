using AFBack.Common;
using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Features.MessageNotifications.Repository;

namespace AFBack.Features.MessageNotifications.Service;

public class MessageNotificationStateService(
    ILogger<MessageNotificationStateService> logger,
    IMessageNotificationRepository messageNotificationRepository) : IMessageNotificationStateService
{
    /// <inheritdoc />
    public async Task<Result> MarkAsReadAsync(string userId, int messageNotificationId)
    {
        logger.LogInformation("User {UserId} is marking MessageNotification {MessageNotificationId} as read",
            userId, messageNotificationId);
    
        // Hent notification med tracking
        var notification = await messageNotificationRepository.GetMessageNotificationAsync(messageNotificationId);
        if (notification == null)
        {
            logger.LogWarning("User {UserId} tried to mark MessageNotification {MessageNotificationId} " +
                              "as read, but it does not exist", userId, messageNotificationId);
            return Result.Failure("Message Notification not found", ErrorTypeEnum.NotFound);
        }
    
        // Verifiser at brukeren er mottaker
        if (notification.RecipientId != userId)
        {
            logger.LogWarning("User {UserId} tried to mark MessageNotification {MessageNotificationId} " +
                              "as read, but it belongs to another user", userId, messageNotificationId);
            return Result.Failure("Message Notification not found", ErrorTypeEnum.NotFound);
        }
    
        // Allerede lest - idempotent, returner suksess
        if (notification.IsRead)
        {
            logger.LogDebug("MessageNotification {MessageNotificationId} is already marked as read",
                messageNotificationId);
            return Result.Success();
        }
    
        // 4. Marker som lest
        notification.IsRead = true;
        notification.ReadAt = DateTime.UtcNow;
    
        await messageNotificationRepository.SaveMessageNotificationAsync();
    
        logger.LogInformation("MessageNotification {MessageNotificationId} marked as read by user {UserId}",
            messageNotificationId, userId);
    
        return Result.Success();
    }
    
    /// <inheritdoc />
    public async Task<Result> MarkAllAsReadByConversationAsync(string userId, int conversationId)
    {
        logger.LogInformation("User {UserId} is marking all notifications as read for conversation {ConversationId}",
            userId, conversationId);
    
        // Hent alle uleste notifications for samtalen
        var notifications = await messageNotificationRepository
            .GetUnreadMessageNotificationsForConversationAsync(userId, conversationId);
    
        // Ingen uleste. Brukeren kan ha hentet til en samtale brukeren ikke er meldem av, eller det er ingen
        // notifkasjoner
        if (notifications.Count == 0)
        {
            logger.LogDebug("No unread notifications found for user {UserId} in conversation {ConversationId}",
                userId, conversationId);
            return Result.Success();
        }
    
        // Marker alle som lest
        var now = DateTime.UtcNow;
        foreach (var notification in notifications)
        {
            notification.IsRead = true;
            notification.ReadAt = now;
        }
    
        await messageNotificationRepository.SaveMessageNotificationAsync();
    
        logger.LogInformation("Marked {Count} notifications as read for user {UserId} in conversation {ConversationId}",
            notifications.Count, userId, conversationId);
    
        return Result.Success();
    }
    
    /// <inheritdoc />
    public async Task<Result> MarkAllAsReadAsync(string userId)
    {
        logger.LogInformation("User {UserId} is marking all notifications as read", userId);

        // Hent alle uleste notifications for brukeren
        var notifications = await messageNotificationRepository.GetAllUnreadNotificationsAsync(userId);

        // Ingen uleste
        if (notifications.Count == 0)
        {
            logger.LogDebug("No unread notifications found for user {UserId}", userId);
            return Result.Success();
        }

        // Marker alle som lest
        var now = DateTime.UtcNow;
        foreach (var notification in notifications)
        {
            notification.IsRead = true;
            notification.ReadAt = now;
        }

        await messageNotificationRepository.SaveMessageNotificationAsync();

        logger.LogInformation("Marked {Count} notifications as read for user {UserId}",
            notifications.Count, userId);

        return Result.Success();
    }
}
