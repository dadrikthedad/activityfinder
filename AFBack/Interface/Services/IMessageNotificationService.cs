using AFBack.DTOs;
using AFBack.Models;

namespace AFBack.Interface.Services;

public interface IMessageNotificationService
{
    Task<MessageResponseDTO> CreateSystemMessageAsync(int conversationId, string messageText,
        List<int>? excludeUserIds = null);

    Task CreateMessageNotificationAsync(int recipientUserId, int senderUserId, int conversationId, int messageId);

    Task<MessageNotificationDTO> BuildNotificationDto(
        MessageNotification notification,
        bool isGroup,
        string? groupName,
        string? groupImageUrl);

    Task<MessageNotificationDTO?> CreateMessageRequestNotificationAsync(int senderId, int receiverId,
        int conversationId);

    Task<MessageNotificationDTO> CreateMessageRequestApprovedNotificationAsync(
        int approverId,
        int senderId,
        int conversationId);

    Task<MessageNotificationDTO> CreateMessageReactionNotificationAsync(
        int reactingUserId,
        int receiverUserId,
        int messageId,
        int conversationId,
        string emoji);

    Task<MessageNotificationDTO?> CreateGroupRequestNotificationAsync(
        int senderId,
        int receiverId,
        int conversationId,
        int groupRequestId,
        string groupName);

    MessageNotificationDTO MapToDto(MessageNotification n, HashSet<int>? rejectedConversations = null,
        bool isUpdate = false);

    Task<(List<MessageNotificationDTO> notifications, int totalCount)> GetUserNotificationsAsync(
        int userId,
        int page = 1,
        int pageSize = 20);
}
