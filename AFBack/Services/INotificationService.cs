using AFBack.DTOs;
using AFBack.Models;

namespace AFBack.Services;

public interface INotificationService
{
    Task CreateNotificationAsync(
        int recipientUserId,
        int? relatedUserId,
        NotificationEntityType type,
        string? message = null,
        int? postId = null,
        int? commentId = null,
        int? friendInvitationId = null,
        int? eventInvitationId = null,
        int? conversationId = null
    );
    
    Task<List<NotificationDTO>> GetUserNotificationsAsync(int userId, int page = 1, int pageSize = 100);
    Task<List<NotificationDTO>> GetRecentNotificationsForBootstrapAsync(int userId, int limit = 20);
}