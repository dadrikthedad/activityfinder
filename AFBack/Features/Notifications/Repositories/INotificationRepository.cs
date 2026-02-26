using AFBack.Features.Notifications.Models;

namespace AFBack.Features.Notifications.Repositories;

public interface INotificationRepository
{
    /// <summary>
    /// Oppretter en notifikasjon og lagrer
    /// </summary>
    Task CreateNotificationAsync(Notification notification);
    
    /// <summary>
    /// Henter paginerte notifikasjoner for en bruker, sortert nyeste først
    /// </summary>
    /// <param name="userId">Brukeren som eier notifikasjonene</param>
    /// <param name="page">Sidenummer (1-indeksert)</param>
    /// <param name="pageSize">Antall per side</param>
    /// <returns>Paginerte notifikasjoner og totalt antall</returns>
    Task<(List<Notification> Items, int TotalCount)> GetPaginatedNotificationsAsync(
        string userId, int page, int pageSize);
    
    /// <summary>
    /// Henter en notifikasjon med tracking for oppdatering
    /// </summary>
    /// <param name="notificationId">Notifikasjonens ID</param>
    /// <returns>Notifikasjon eller null hvis ikke funnet</returns>
    Task<Notification?> GetNotificationAsync(int notificationId);
    
    /// <summary>
    /// Henter antall uleste notifikasjoner for en bruker
    /// </summary>
    /// <param name="userId">Brukeren som eier notifikasjonene</param>
    /// <returns>Antall uleste notifikasjoner</returns>
    Task<int> GetUnreadCountAsync(string userId);
    
    /// <summary>
    /// Markerer alle notifikasjoner som lest for en bruker
    /// </summary>
    /// <param name="userId">Brukeren som eier notifikasjonene</param>
    Task MarkAllAsReadAsync(string userId);
    
    /// <summary>
    /// Lagrer endringer til databasen
    /// </summary>
    Task SaveNotificationAsync();
    
    /// <summary>
    /// Sletter en notifikasjon fra databasen
    /// </summary>
    /// <param name="notification">Notifikasjonen som skal slettes</param>
    Task DeleteNotificationAsync(Notification notification);
    
    /// <summary>
    /// Sletter alle notifikasjoner for en bruker
    /// </summary>
    /// <param name="userId">Brukeren som eier notifikasjonene</param>
    Task DeleteAllNotificationsAsync(string userId);
}
