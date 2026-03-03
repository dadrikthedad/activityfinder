using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.MessageNotification.Models;

namespace AFBack.Features.MessageNotifications.Repository;

public interface IMessageNotificationRepository
{
    // ============ MessageNotification ============
    
    /// <summary>
    /// Henter en MessageNotification med Id med tracking
    /// </summary>
    /// <param name="messageNotificationId">ID-en til MessageNotification</param>
    /// <returns>MessageNotification</returns>
    Task<Models.MessageNotification?> GetMessageNotificationAsync(int messageNotificationId);
    
    /// <summary>
    /// Henter en MessageNotification med Id
    /// </summary>
    /// <param name="messageNotificationId">ID-en til MessageNotification</param>
    /// <returns>MessageNotification</returns>
    Task<Models.MessageNotification?> GetMessageNotificationWithConversationAsync(int messageNotificationId);
    
    /// <summary>
    /// Henter en MessageNotification til en mottaker utifra avsender og samtalen, så fremt den ikke er lest
    /// </summary>
    /// <param name="recipientId">Mottaker</param>
    /// <param name="senderId">Avsender</param>
    /// <param name="conversationResponse">ConversationResponse for å finne Id og type samtale</param>
    /// <returns>En MessageNotification-entitet eller null</returns>
    Task<Models.MessageNotification?> GetMessageNotificationWithSenderIdAsync(string recipientId, string senderId,
        ConversationResponse conversationResponse);


    /// <summary>
    /// Henter eksisterende ulest reaksjons-notifikasjon for en bruker i en samtale
    /// </summary>
    /// <param name="recipientId">Mottaker</param>
    /// <param name="conversationId">Samtalen</param>
    /// <returns>MessageNotification eller null</returns>
    Task<Models.MessageNotification?> GetReactionNotificationAsync(string recipientId, int conversationId);
    
    /// <summary>
    /// Henter alle uleste MessageNotifications for en bruker i en spesifikk samtale.
    /// Med tracking for oppdatering, uten Include.
    /// </summary>
    /// <param name="userId">Brukerens ID</param>
    /// <param name="conversationId">Samtalens ID</param>
    /// <returns>Liste med uleste MessageNotifications</returns>
    Task<List<Models.MessageNotification>> GetUnreadMessageNotificationsForConversationAsync(
        string userId, int conversationId);
    
    /// <summary>
    /// Henter antall uleste MessageNotifications for en bruker.
    /// </summary>
    /// <param name="userId">Brukerens ID</param>
    /// <returns>Antall uleste notifikasjoner</returns>
    Task<int> GetUnreadCountAsync(string userId);
    
    /// <summary>
    /// Henter unike conversation-IDer som har uleste MessageNotifications for en bruker
    /// </summary>
    /// <param name="userId">Brukerens ID</param>
    /// <returns>Liste med unike conversation-IDer</returns>
    Task<List<int>> GetUnreadConversationIdsAsync(string userId);

    /// <summary>
    /// Henter alle uleste notifikasjoner for en bruker
    /// </summary>
    /// <param name="userId">Brukerens ID</param>
    /// <returns>REn liste med meldingsnotifikasjoner</returns>
    Task<List<Models.MessageNotification>> GetAllUnreadNotificationsAsync(string userId);

    /// <summary>
    /// Henter alle MessageNotifications for en bruker i en spesifikk samtale.
    /// Sortert på LastUpdatedAt/CreatedAt descending, uten Include.
    /// </summary>
    /// <param name="userId">Brukerens ID</param>
    /// <param name="conversationId">Samtalens ID</param>
    /// <returns>Liste med MessageNotifications</returns>
    Task<List<Models.MessageNotification>> GetMessageNotificationsForConversationAsync(string userId, int conversationId);
    
    /// <summary>
    /// Sletter en MessageNotification fra databasen
    /// </summary>
    /// <param name="notification">MessageNotification som skal slettes</param>
    Task DeleteMessageNotificationAsync(Models.MessageNotification notification);

    /// <summary>
    /// Sletter alle MessageNotifications for en bruker
    /// </summary>
    /// <param name="userId">Brukeren som skal ha alle notifications slettet</param>
    /// <returns></returns>
    Task DeleteAllMessageNotificationsAsync(string userId);
    
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
    /// Henter den siste GroupEvent-notifikasjonen for en bruker i en samtale, uavhengig av lest-status.
    /// Brukes når brukeren er aktiv i samtalen og nye events skal legges til eksisterende notification.
    /// </summary>
    /// <param name="recipientId">Mottakeren av messagenotification</param>
    /// <param name="conversationId">Samtalen det gjelder</param>
    /// <returns>MessageNotification eller null hvis ingen</returns>
    Task<Models.MessageNotification?> GetLatestGroupEventNotificationAsync(string recipientId, int conversationId);
    
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
    
    // ============ Paginering ============
    
    /// <summary>
    /// Henter paginerte MessageNotifications for en bruker sortert på LastUpdatedAt/CreatedAt descending
    /// </summary>
    /// <param name="userId">Brukerens ID</param>
    /// <param name="page">Sidetall (1-indeksert)</param>
    /// <param name="pageSize">Antall per side</param>
    /// <returns>Tuple med liste av notifications og totalt antall</returns>
    Task<(List<Models.MessageNotification> Items, int TotalCount)> GetPaginatedNotificationsAsync(
        string userId, int page, int pageSize);

    /// <summary>
    /// Henter GroupEvents for flere notifications i én query, sortert på CreatedAt descending.
    /// Gruppering og begrensning per notification håndteres i service-laget.
    /// </summary>
    /// <param name="notificationIds">Liste med notification IDs</param>
    /// <returns>Liste med tupler (MessageNotificationId, GroupEvent)</returns>
    Task<List<(int MessageNotificationId, GroupEvent GroupEvent)>> GetGroupEventsForNotificationsAsync(
        List<int> notificationIds);
}
