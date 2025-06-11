using AFBack.DTOs;
using Microsoft.EntityFrameworkCore;
using Serilog;

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

    public async Task CreateNotificationAsync(
        int recipientUserId,
        int? relatedUserId,
        NotificationEntityType type,
        string? message = null,
        int? postId = null,
        int? commentId = null,
        int? friendInvitationId = null,
        int? eventInvitationId = null,
        int? conversationId = null
    )
    {
        var notification = new Notification
        {
            Type = type,
            RecipientUserId = recipientUserId,
            RelatedUserId = relatedUserId,
            Message = message,
            CreatedAt = DateTime.UtcNow,
            IsRead = false,
            PostId = postId,
            CommentId = commentId,
            FriendInvitationId = friendInvitationId,
            EventInvitationId = eventInvitationId,
            ConversationId = conversationId 
        };
        
        UserSummaryDTO? relatedUserDto = null;
        
        if (relatedUserId.HasValue)
        {
            var relatedUser = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == relatedUserId.Value);

            if (relatedUser != null)
            {
                relatedUserDto = new UserSummaryDTO
                {
                    Id = relatedUser.Id,
                    FullName = relatedUser.FullName,
                    ProfileImageUrl = relatedUser.Profile?.ProfileImageUrl
                };
            }
        }

        Log.Information("🔔 Notification created for user {RecipientUserId} of type {Type}", recipientUserId, type);

        _context.Notifications.Add(notification);
        await _context.SaveChangesAsync();

        Log.Information("📡 Sender notification via SignalR til {UserId}", recipientUserId);

        await _hubContext.Clients.User(recipientUserId.ToString())
            .SendAsync("ReceiveNotification", new
            {
                notification.Id,
                notification.Type,
                notification.Message,
                notification.CreatedAt,
                notification.PostId,
                notification.CommentId,
                notification.FriendInvitationId,
                notification.EventInvitationId,
                notification.ConversationId, 
                RelatedUser = relatedUserDto
            });
    }
}

