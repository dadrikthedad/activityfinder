using AFBack.Common.DTOs;
using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Features.Notifications.DTOs.Responses;
using AFBack.Features.Notifications.Enums;
using AFBack.Features.Notifications.Models;
using AFBack.Features.Notifications.Repositories;
using AFBack.Infrastructure.Cache;

namespace AFBack.Features.Notifications.Services;

public class NotificationService(
    ILogger<NotificationService> logger,
    INotificationRepository notificationRepository,
    IUserSummaryCacheService userSummaryCacheService) : INotificationService
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
    
    /// <inheritdoc />
    public async Task<Result<PaginatedResponse<NotificationResponse>>> GetNotificationsAsync(
        string userId, PaginationRequest request)
    {
        logger.LogInformation("User {UserId} is retrieving notifications - Page: {Page}, PageSize: {PageSize}",
            userId, request.Page, request.PageSize);
        
        var (notifications, totalCount) = await notificationRepository
            .GetPaginatedNotificationsAsync(userId, request.Page, request.PageSize);
        
        if (notifications.Count == 0)
        {
            logger.LogInformation("No notifications found for user {UserId}", userId);
            return Result<PaginatedResponse<NotificationResponse>>.Success(
                new PaginatedResponse<NotificationResponse>
                {
                    Items = [],
                    TotalCount = totalCount,
                    Page = request.Page,
                    PageSize = request.PageSize
                });
        }
        
        // Samle alle unike RelatedUserIds for batch-henting fra cache
        var relatedUserIds = notifications
            .Where(n => n.RelatedUserId != null)
            .Select(n => n.RelatedUserId!)
            .Distinct()
            .ToList();
        
        var userSummaries = await userSummaryCacheService
            .GetUserSummariesAsync(relatedUserIds);
        
        // Map til responses
        var responses = notifications
            .Select(n => new NotificationResponse
            {
                Id = n.Id,
                Type = n.Type,
                Summary = n.Summary,
                IsRead = n.IsRead,
                CreatedAt = n.CreatedAt,
                RelatedUserSummaryDto = n.RelatedUserId != null 
                    ? userSummaries.GetValueOrDefault(n.RelatedUserId)
                    : null
            })
            .ToList();
        
        logger.LogInformation("Retrieved {Count} notifications for user {UserId} (Total: {Total})",
            responses.Count, userId, totalCount);
        
        return Result<PaginatedResponse<NotificationResponse>>.Success(
            new PaginatedResponse<NotificationResponse>
            {
                Items = responses,
                TotalCount = totalCount,
                Page = request.Page,
                PageSize = request.PageSize
            });
    }
    
    /// <inheritdoc />
    public async Task<int> GetUnreadCountAsync(string userId)
    {
        logger.LogDebug("User {UserId} is retrieving unread notification count", userId);
    
        return await notificationRepository.GetUnreadCountAsync(userId);
    }
    
    /// <inheritdoc />
    public async Task<Result> MarkAsReadAsync(string userId, int notificationId)
    {
        logger.LogInformation("User {UserId} is marking Notification {NotificationId} as read",
            userId, notificationId);
        
        // Hent notification med tracking
        var notification = await notificationRepository.GetNotificationAsync(notificationId);
        if (notification == null)
        {
            logger.LogWarning("User {UserId} tried to mark Notification {NotificationId} " +
                              "as read, but it does not exist", userId, notificationId);
            return Result.Failure("Notification not found", ErrorTypeEnum.NotFound);
        }
        
        // Verifiser at brukeren er mottaker
        if (notification.RecipientUserId != userId)
        {
            logger.LogWarning("User {UserId} tried to mark Notification {NotificationId} " +
                              "as read, but it belongs to another user", userId, notificationId);
            return Result.Failure("Notification not found", ErrorTypeEnum.NotFound);
        }
        
        // Allerede lest - idempotent, returner suksess
        if (notification.IsRead)
        {
            logger.LogDebug("Notification {NotificationId} is already marked as read", notificationId);
            return Result.Success();
        }
        
        // Marker som lest
        notification.IsRead = true;
        
        await notificationRepository.SaveNotificationAsync();
        
        logger.LogInformation("Notification {NotificationId} marked as read by user {UserId}",
            notificationId, userId);
        
        return Result.Success();
    }
    
    /// <inheritdoc />
    public async Task<Result> MarkAllAsReadAsync(string userId)
    {
        logger.LogInformation("User {UserId} is marking all notifications as read", userId);
    
        await notificationRepository.MarkAllAsReadAsync(userId);
    
        logger.LogInformation("All notifications marked as read for user {UserId}", userId);
    
        return Result.Success();
    }
    
    /// <inheritdoc />
    public async Task<Result> DeleteNotificationAsync(string userId, int notificationId)
    {
        logger.LogInformation("User {UserId} is deleting Notification {NotificationId}",
            userId, notificationId);
        
        // Hent notification med tracking
        var notification = await notificationRepository.GetNotificationAsync(notificationId);
        if (notification == null)
        {
            logger.LogWarning("User {UserId} tried to delete Notification {NotificationId} " +
                              "that does not exist", userId, notificationId);
            return Result.Failure("Notification not found", ErrorTypeEnum.NotFound);
        }
        
        // Verifiser at brukeren er mottaker
        if (notification.RecipientUserId != userId)
        {
            logger.LogWarning("User {UserId} tried to delete Notification {NotificationId} " +
                              "that belongs to another user", userId, notificationId);
            return Result.Failure("Notification not found", ErrorTypeEnum.NotFound);
        }
        
        await notificationRepository.DeleteNotificationAsync(notification);
        
        logger.LogInformation("Notification {NotificationId} deleted by user {UserId}",
            notificationId, userId);
        
        return Result.Success();
    }
    
    /// <inheritdoc />
    public async Task<Result> DeleteAllNotificationsAsync(string userId)
    {
        logger.LogInformation("User {UserId} is deleting all notifications", userId);
        
        await notificationRepository.DeleteAllNotificationsAsync(userId);
        
        logger.LogInformation("All notifications deleted for user {UserId}", userId);
        
        return Result.Success();
    }
}
