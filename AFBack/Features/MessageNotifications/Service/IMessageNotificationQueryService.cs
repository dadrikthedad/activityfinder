using AFBack.Common.DTOs;
using AFBack.Common.Results;
using AFBack.Features.MessageNotifications.DTOs;

namespace AFBack.Features.MessageNotifications.Service;

public interface IMessageNotificationQueryService
{
    /// <summary>
    /// Henter en enkelt MessageNotification for en bruker
    /// </summary>
    /// <param name="userId">Brukerens ID</param>
    /// <param name="messageNotificationId">ID-en til notifikasjonen</param>
    /// <returns>MessageNotificationResponse eller feil</returns>
    Task<Result<MessageNotificationResponse>> GetMessageNotificationAsync(string userId, int messageNotificationId);
    
    /// <summary>
    /// Henter paginerte MessageNotifications for en bruker
    /// </summary>
    /// <param name="userId">Brukerens ID</param>
    /// <param name="request">Pagineringsparametre</param>
    /// <returns>Paginert liste med MessageNotificationResponse</returns>
    Task<Result<PaginatedResponse<MessageNotificationResponse>>> GetNotificationsAsync(
        string userId, PaginationRequest request);
    
    /// <summary>
    /// Henter alle MessageNotifications for en bruker i en spesifikk samtale.
    /// </summary>
    /// <param name="userId">Brukerens ID</param>
    /// <param name="conversationId">Samtalens ID</param>
    /// <returns>Liste med MessageNotificationResponse</returns>
    Task<Result<List<MessageNotificationResponse>>> GetNotificationsByConversationAsync(
        string userId, int conversationId);
    
    /// <summary>
    /// Henter antall uleste MessageNotifications for en bruker.
    /// </summary>
    /// <param name="userId">Brukerens ID</param>
    /// <returns>Antall uleste notifikasjoner</returns>
    Task<int> GetUnreadCountAsync(string userId);
    
    /// <summary>
    /// Henter IDer for samtaler med uleste MessageNotifications for en bruker.
    /// Brukes i bootstrap for å markere uleste samtaler i UI.
    /// </summary>
    /// <param name="userId">Brukerens ID</param>
    /// <returns>Liste med unike conversation-IDer som har uleste notifikasjoner</returns>
    Task<List<int>> GetUnreadConversationIdsAsync(string userId);
}
