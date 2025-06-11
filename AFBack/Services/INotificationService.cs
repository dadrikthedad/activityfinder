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
}