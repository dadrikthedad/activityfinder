using AFBack.Features.Conversation.DTOs;
using AFBack.Features.Conversation.DTOs.Response;
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
        ConversationResponse conversationResponse);
    
    /// <summary>
    /// Oppretter en notification til brukeren som har sendt en Pending Conversation Request og fått den akseptert
    /// </summary>
    /// <param name="recipientId">Sender av forespørselen</param>
    /// <param name="senderId">Mottaker av forespørselen som har godkjent</param>
    /// <param name="conversationResponse">ConversationResponse med samtale info</param>
    Task CreateConversationAcceptedNotificationAsync(string recipientId, string senderId,
        ConversationResponse conversationResponse);
    
    /// <summary>
    /// Oppretter en notification for når en bruker blir med i en gruppesamtale.
    /// Sendes til alle eksisterende medlemmer med Accepted status.
    /// </summary>
    /// <param name="recipientId">Mottaker av notifikasjonen (eksisterende gruppemedlem)</param>
    /// <param name="joinedUserId">Brukeren som ble med i gruppen</param>
    /// <param name="conversationResponse">ConversationResponse med samtale info</param>
    Task CreateGroupMemberJoinedNotificationAsync(string recipientId, string joinedUserId,
        ConversationResponse conversationResponse);
    

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
