using AFBack.Constants;
using AFBack.DTOs;
using AFBack.Features.SyncEvents.Services;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace AFBack.Services;
using AFBack.Data;
using AFBack.Models;
using Microsoft.AspNetCore.SignalR;
using AFBack.Hubs;
// Her styrer vi Notifications og sikrer at de brukes i SignalR
public class NotificationService(
    AppDbContext context,
    IHubContext<UserHub> hubContext,
    ISyncService syncService,
    IBackgroundTaskQueue taskQueue)
    : INotificationService
{
    public async Task CreateNotificationAsync(
        int recipientUserId,
        int? relatedUserId,
        NotificationEntityType type,
        string? message = null,
        int? postId = null,
        int? commentId = null,
        int? friendInvitationId = null,
        int? eventInvitationId = null,
        int? conversationId = null,
        UserSummaryDto? relatedUserSummary = null
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
        
        
        UserSummaryDto? relatedUserDto = relatedUserSummary;
        
        if (relatedUserDto == null && relatedUserId.HasValue)
        {
            var relatedUser = await context.AppUsers
                .Include(u => u.UserProfile)
                .FirstOrDefaultAsync(u => u.Id == relatedUserId.Value);

            if (relatedUser != null)
            {
                relatedUserDto = new UserSummaryDto
                {
                    Id = relatedUser.Id,
                    FullName = relatedUser.FullName,
                    ProfileImageUrl = relatedUser.ProfileImageUrl
                };
            }
        }

        Log.Information("🔔 Notification created for appUser {RecipientUserId} of type {Type}", recipientUserId, type);

        context.Notifications.Add(notification);
        await context.SaveChangesAsync();
        
        taskQueue.QueueAsync(async () =>
        {
            try
            {
                var notificationDto = new NotificationDTO
                {
                    Id = notification.Id,
                    Type = notification.Type,
                    Message = notification.Message,
                    IsRead = notification.IsRead,
                    CreatedAt = notification.CreatedAt,
                    PostId = notification.PostId,
                    CommentId = notification.CommentId,
                    FriendInvitationId = notification.FriendInvitationId,
                    EventInvitationId = notification.EventInvitationId,
                    RelatedUser = relatedUserDto // 🎯 Bruker provided/fetched UserSummary
                };

                await syncService.CreateAndDistributeSyncEventAsync(
                    eventType: SyncEventTypes.NOTIFICATION_CREATED,
                    eventData: notificationDto,
                    singleUserId: recipientUserId,
                    source: "NotificationService",
                    relatedEntityId: notification.Id,
                    relatedEntityType: "Notification"
                );
            }
            catch (Exception ex)
            {
                Log.Error(ex, "❌ Failed to create sync event for notification {NotificationId}", notification.Id);
            }
        });

        Log.Information("📡 Sender notification via SignalR til {UserId}", recipientUserId);

        await hubContext.Clients.User(recipientUserId.ToString())
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
    
    public async Task<List<NotificationDTO>> GetUserNotificationsAsync(int userId, int page = 1, int pageSize = 100)
    {
        var notifications = await context.Notifications
            .Include(n => n.RelatedUser).ThenInclude(u => u.UserProfile)
            .Where(n => n.RecipientUserId == userId)
            .OrderByDescending(n => n.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var result = notifications.Select(ToDto).ToList();
        
        
        return result;
    }

    // 🆕 SPESIELL METODE FOR BOOTSTRAP (ingen paginering, bare nyeste):
    public async Task<List<NotificationDTO>> GetRecentNotificationsForBootstrapAsync(int userId, int limit = 20)
    {
        try
        {
            var notifications = await context.Notifications
                .Include(n => n.RelatedUser).ThenInclude(u => u.UserProfile)
                .Where(n => n.RecipientUserId == userId)
                .OrderByDescending(n => n.CreatedAt)
                .Take(limit)
                .ToListAsync();

            var result = notifications.Select(ToDto).ToList();
            
            return result;
        }
        catch (Exception ex)
        {
            return new List<NotificationDTO>(); // Robust: returner tom liste
        }
    }

    // 🆕 FLYTT DENNE HELPER-METODEN HIT (fra controller):
    private static NotificationDTO ToDto(Notification n)
    {
        UserSummaryDto? related = null;

        if (n.RelatedUser != null)
        {
            related = new UserSummaryDto
            {
                Id = n.RelatedUser.Id,
                FullName = n.RelatedUser.FullName,
                ProfileImageUrl = n.RelatedUser.ProfileImageUrl
            };
        }

        return new NotificationDTO
        {
            Id = n.Id,
            Type = n.Type,
            Message = n.Message,
            IsRead = n.IsRead,
            CreatedAt = n.CreatedAt,
            PostId = n.PostId,
            CommentId = n.CommentId,
            FriendInvitationId = n.FriendInvitationId,
            EventInvitationId = n.EventInvitationId,
            RelatedUser = related
        };
    }
}

