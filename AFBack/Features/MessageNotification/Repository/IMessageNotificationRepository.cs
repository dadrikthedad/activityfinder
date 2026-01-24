using AFBack.Features.Conversation.DTOs;

namespace AFBack.Features.MessageNotification.Repository;

public interface IMessageNotificationRepository
{
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
    /// Lagerer en MessageNotification i databasen
    /// </summary>
    Task CreateMessageNotificationAsync(Models.MessageNotification notification);
    
    /// <summary>
    /// Lagrer en tracked MessageNotification i databasen
    /// </summary>
    Task SaveMessageNotificationAsync();
}
