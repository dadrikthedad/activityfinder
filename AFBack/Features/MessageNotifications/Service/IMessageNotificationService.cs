using AFBack.Common.DTOs;
using AFBack.DTOs;
using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.MessageNotifications.DTOs;
using AFBack.Features.Messaging.DTOs.Response;

namespace AFBack.Features.MessageNotifications.Service;

public interface IMessageNotificationService
{
    
    /// <summary>
    /// Lager eller oppdaterer en eksisterende MessageNotification for nye meldinger til både 1-1 og gruppesamtaler.
    /// Systemmeldinger får ingen notifikasjon lagd.
    /// </summary>
    /// <param name="recipientId">Brukeren som mottar notifikasjonen</param>
    /// <param name="senderId">Avsender</param>
    /// <param name="conversationResponse">Samtalen med participants</param>
    /// <param name="messageResponse">Meldingen</param>
    /// <returns>MessageNotificationResponse for inkludering i SyncEvent, eller null hvis ikke opprettet</returns>
    Task<MessageNotificationResponse> CreateNewMessageNotificationAsync(
        string recipientId,
        string senderId,
        ConversationResponse conversationResponse,
        MessageResponse messageResponse
    );

    /// <summary>
    /// Oppretter en notification for en innkommende santaleforespørsel. Både vanlig samtaler og gruppesamtaler
    /// </summary>
    /// <param name="recipientId">Mottaker av forespørselen</param>
    /// <param name="senderId">Avsender</param>
    /// <param name="conversationResponse">ConversationResponse med samtale info</param>
    /// <returns>MessageNotificationResponse for inkludering i SyncEvent, eller null hvis ikke opprettet</returns>
    Task<MessageNotificationResponse> CreatePendingConversationNotificationAsync(string recipientId, string senderId,
        ConversationResponse conversationResponse);

    /// <summary>
    /// Oppretter en notification til brukeren som har sendt en Pending Conversation Request og fått den akseptert
    /// Kun 1-1 (Direct)
    /// </summary>
    /// <param name="recipientId">Sender av forespørselen</param>
    /// <param name="senderId">Mottaker av forespørselen som har godkjent</param>
    /// <param name="conversationResponse">ConversationResponse med samtale info</param>
    /// <param name="notificationSummary">Summary teksten for notifikasjonen</param>
    /// <param name="senderUserSummary">Brukeren sin UserSummary for å vise fult navn og bilde i frontend</param>
    /// <param name="isRead">Er brukeren i den aktive samtalen så er den allerede lest</param>
    /// <returns>MessageNotificationResponse for inkludering i SyncEvent</returns>
    Task<MessageNotificationResponse> CreateConversationAcceptedNotificationAsync(string recipientId,
        string senderId, ConversationResponse conversationResponse, string notificationSummary,
        UserSummaryDto senderUserSummary, bool isRead = false);

}
