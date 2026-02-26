using AFBack.Common.DTOs;
using AFBack.Common.Results;
using AFBack.Features.Notifications.DTOs.Responses;
using AFBack.Features.Notifications.Enums;

namespace AFBack.Features.Notifications.Services;

public interface INotificationService
{
    /// <summary>
    /// Oppretter en notifikasjon og lagrer i databasen
    /// </summary>
    /// <param name="recipientUserId">Mottaker av notifikasjonen</param>
    /// <param name="relatedUserId">Brukeren som utløste hendelsen</param>
    /// <param name="type">Type notifikasjon</param>
    /// <param name="summary">Notification-teksten som vises til brukeren</param>
    /// <param name="relatedUserSummaryDto">UserSummaryDTO-en til brukeren som trigget notifikasjonen</param>
    /// <returns>NotificationResponse</returns>
    Task<NotificationResponse> CreateNotificationAsync(string recipientUserId, string relatedUserId,
        NotificationEventType type, string summary, UserSummaryDto relatedUserSummaryDto);
    
    /// <summary>
    /// Henter paginerte notifikasjoner for en bruker med RelatedUser fra cache
    /// </summary>
    /// <param name="userId">Brukeren som eier notifikasjonene</param>
    /// <param name="request">Pagineringsparametre</param>
    /// <returns>Paginert liste med NotificationResponse</returns>
    Task<Result<PaginatedResponse<NotificationResponse>>> GetNotificationsAsync(
        string userId, PaginationRequest request);
    
    /// <summary>
    /// Henter antall uleste notifikasjoner for en bruker
    /// </summary>
    /// <param name="userId">Brukeren som eier notifikasjonene</param>
    /// <returns>Antall uleste notifikasjoner</returns>
    Task<int> GetUnreadCountAsync(string userId);
    
    /// <summary>
    /// Markerer en notifikasjon som lest. Idempotent - returnerer suksess hvis allerede lest.
    /// </summary>
    /// <param name="userId">Brukeren som markerer notifikasjonen som lest</param>
    /// <param name="notificationId">Notifikasjonens ID</param>
    /// <returns>Result som indikerer suksess eller feil</returns>
    Task<Result> MarkAsReadAsync(string userId, int notificationId);
    
    /// <summary>
    /// Markerer alle notifikasjoner som lest for en bruker. Idempotent.
    /// </summary>
    /// <param name="userId">Brukeren som markerer notifikasjonene som lest</param>
    /// <returns>Result som indikerer suksess eller feil</returns>
    Task<Result> MarkAllAsReadAsync(string userId);
    
    /// <summary>
    /// Sletter en notifikasjon. Validerer at brukeren eier notifikasjonen.
    /// </summary>
    /// <param name="userId">Brukeren som sletter notifikasjonen</param>
    /// <param name="notificationId">Notifikasjonens ID</param>
    /// <returns>Result som indikerer suksess eller feil</returns>
    Task<Result> DeleteNotificationAsync(string userId, int notificationId);
    
    /// <summary>
    /// Sletter alle notifikasjoner for en bruker
    /// </summary>
    /// <param name="userId">Brukeren som sletter notifikasjonene</param>
    /// <returns>Result som indikerer suksess eller feil</returns>
    Task<Result> DeleteAllNotificationsAsync(string userId);
}
