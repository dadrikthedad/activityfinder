using AFBack.Features.Conversation.DTOs;
using AFBack.Features.Messaging.DTOs.Response;
using AFBack.Models;

namespace AFBack.Features.MessageNotification.Service;

public interface IMessageNotificationService
{
    
    /// <summary>
    /// Lager eller oppdaterer en eksisterende MessageNotification for nye meldinger til både 1-1 og gruppesamtaler.
    /// Systemmeldinger får ingen notifikasjon lagd
    /// </summary>
    /// <param name="recipientId">Brukeren som mottar notifikasjonen</param>
    /// <param name="senderId">Avsender</param>
    /// <param name="conversationResponse">Samtalen med participants</param>
    /// <param name="messageResponse">Meldingen</param>
    Task CreateNewMessageNotificationAsync(
        string recipientId,
        string senderId,
        ConversationResponse conversationResponse,
        MessageResponse messageResponse
    );
    
    /// <summary>
    /// Oppretter en notification for en innkommende santaleforespørsel
    /// </summary>
    /// <param name="recipientId">Mottaker av forespørselen</param>
    /// <param name="senderId">Avsender</param>
    /// <param name="conversationResponse">ConversationResponse med samtale info</param>
    /// <param name="messageResponse">MessageResponse med meldings info</param>
    Task CreatePendingConversationNotificationAsync(string recipientId, string senderId,
        ConversationResponse conversationResponse, MessageResponse messageResponse);
    

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

    MessageNotificationDTO MapToDto(Models.MessageNotification n, HashSet<int>? rejectedConversations = null,
        bool isUpdate = false);

    Task<(List<MessageNotificationDTO> notifications, int totalCount)> GetUserNotificationsAsync(
        int userId,
        int page = 1,
        int pageSize = 20);
}
