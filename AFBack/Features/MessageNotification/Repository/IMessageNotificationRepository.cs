using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.MessageNotification.Models;


namespace AFBack.Features.MessageNotification.Repository;

public interface IMessageNotificationRepository
{
    // ============ MessageNotification ============
    
    /// <summary>
    /// Henter en MessageNotification til en mottaker utifra avsender og samtalen, så fremt den ikke er lest
    /// </summary>
    /// <param name="recipientId">Mottaker</param>
    /// <param name="senderId">Avsender</param>
    /// <param name="conversationResponse">ConversationResponse for å finne Id og type samtale</param>
    /// <returns>En MessageNotification-entitet eller null</returns>
    Task<Models.MessageNotification?> GetMessageNotificationAsync(string recipientId, string senderId,
        ConversationResponse conversationResponse);
    
    /// <summary>
    /// Lagrer en MessageNotification i databasen
    /// </summary>
    Task CreateMessageNotificationAsync(Models.MessageNotification notification);
    
    /// <summary>
    /// Lagrer endringer på tracked entiteter i databasen
    /// </summary>
    Task SaveMessageNotificationAsync();
    
    // ============ GroupEvent ============
    
    /// <summary>
    /// Henter en eksisterende ulest GroupEvent-notification for en bruker i en samtale.
    /// Brukes for å stacke flere GroupEvents på samme notification.
    /// </summary>
    /// <param name="recipientId">Mottakere av notifikasjonen</param>
    /// <param name="conversationId">Samtalen notifkasjonen er for</param>
    /// <returns>MessageNotification eller null</returns>
    Task<Models.MessageNotification?> GetUnreadGroupEventNotificationAsync(string recipientId, int conversationId);
    
    /// <summary>
    /// Lagrer en GroupEvent i databasen
    /// </summary>
    Task CreateGroupEventAsync(GroupEvent groupEvent);
    
    
    /// <summary>
    /// Henter alle gruppeeventene til en bruker. Det er satt en limit i ApplicationCosntants.
    /// Hver MessageNotifation får da så mange gruppeevents i sin GroupEvents egenskap
    /// </summary>
    /// <param name="notificationId">ID-en til notifikasjonen</param>
    /// <returns>En liste med GroupEvent</returns>
    Task<List<GroupEvent>> GetGroupEventsForNotificationAsync(int notificationId);
    
    // ============ MessageNotificationGroupEvent ============
    
    /// <summary>
    /// Lagrer en kobling mellom MessageNotification og GroupEvent
    /// </summary>
    Task CreateMessageNotificationGroupEventAsync(MessageNotificationGroupEvent messageNotificationGroupEvent);
    
    /// <summary>
    /// Kobler en GroupEvent til en MessageNotification
    /// </summary>
    /// <param name="notificationId">Id på MessageNotification</param>
    /// <param name="groupEventId">Id på GroupEvent</param>
    Task LinkGroupEventToNotificationAsync(int notificationId, int groupEventId);
}
