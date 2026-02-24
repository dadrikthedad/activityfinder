using AFBack.Common.DTOs;
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
}
