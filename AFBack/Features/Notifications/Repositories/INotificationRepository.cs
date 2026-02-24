using AFBack.Features.Notifications.Models;

namespace AFBack.Features.Notifications.Repositories;

public interface INotificationRepository
{
    /// <summary>
    /// Oppretter en notifikasjon og lagrer
    /// </summary>
    Task CreateNotificationAsync(Notification notification);
}
