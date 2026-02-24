using AFBack.Data;
using AFBack.Features.Notifications.Models;

namespace AFBack.Features.Notifications.Repositories;

public class NotificationRepository(AppDbContext context) : INotificationRepository
{
    /// <inheritdoc />
    public async Task CreateNotificationAsync(Notification notification)
    {
        await context.Notifications.AddAsync(notification);
        await context.SaveChangesAsync();
    }
}
