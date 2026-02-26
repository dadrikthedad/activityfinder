using AFBack.Data;
using AFBack.Features.Notifications.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.Notifications.Repositories;

public class NotificationRepository(AppDbContext context) : INotificationRepository
{
    /// <inheritdoc />
    public async Task CreateNotificationAsync(Notification notification)
    {
        await context.Notifications.AddAsync(notification);
        await context.SaveChangesAsync();
    }
    
    /// <inheritdoc />
    public async Task<(List<Notification> Items, int TotalCount)> GetPaginatedNotificationsAsync(
        string userId, int page, int pageSize)
    {
        var query = context.Notifications
            .AsNoTracking()
            .Where(n => n.RecipientUserId == userId)
            .OrderByDescending(n => n.CreatedAt);
        
        var totalCount = await query.CountAsync();
        
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
        
        return (items, totalCount);
    }
    
    /// <inheritdoc />
    public async Task<Notification?> GetNotificationAsync(int notificationId)
        => await context.Notifications.FirstOrDefaultAsync(n => n.Id == notificationId);
    
    /// <inheritdoc />
    public async Task<int> GetUnreadCountAsync(string userId)
        => await context.Notifications
            .CountAsync(n => n.RecipientUserId == userId && !n.IsRead);
    
    /// <inheritdoc />
    public async Task MarkAllAsReadAsync(string userId) =>
        await context.Notifications
            .Where(n => n.RecipientUserId == userId && !n.IsRead)
            .ExecuteUpdateAsync(s => 
                s.SetProperty(n => n.IsRead, true));
    
    
    /// <inheritdoc />
    public async Task SaveNotificationAsync() => await context.SaveChangesAsync();
    
    /// <inheritdoc />
    public async Task DeleteNotificationAsync(Notification notification)
    {
        context.Notifications.Remove(notification);
        await context.SaveChangesAsync();
    }
    
    /// <inheritdoc />
    public async Task DeleteAllNotificationsAsync(string userId) =>
        await context.Notifications
            .Where(n => n.RecipientUserId == userId)
            .ExecuteDeleteAsync();
    
}
