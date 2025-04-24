namespace AFBack.Services;
using AFBack.Data;
using AFBack.Models;
using Microsoft.AspNetCore.SignalR;
using AFBack.Hubs;
// Her styrer vi Notifications og sikrer at de brukes i SignalR
public class NotificationService : INotificationService
{
    private readonly ApplicationDbContext _context;
    private readonly IHubContext<NotificationHub> _hubContext;

    public NotificationService(ApplicationDbContext context, IHubContext<NotificationHub> hubContext)
    {
        _context = context;
        _hubContext = hubContext;
    }

    public async Task CreateNotificationAsync(int recipientUserId, int? relatedUserId, string type, string? message = null)
    {
        var notification = new Notification
        {
            Type = type,
            RecipientUserId = recipientUserId,
            RelatedUserId = relatedUserId,
            Message = message,
            CreatedAt = DateTime.UtcNow,
            IsRead = false
        };

        _context.Notifications.Add(notification);
        await _context.SaveChangesAsync();

        // Send sanntidsvarsel til den spesifikke brukeren
        await _hubContext.Clients.User(recipientUserId.ToString())
            .SendAsync("ReceiveNotification", new
            {
                notification.Id,
                notification.Type,
                notification.Message,
                notification.CreatedAt
            });
    }
}

