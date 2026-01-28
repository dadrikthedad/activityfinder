using AFBack.Common;
using AFBack.Data;
using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.MessageNotification.Models;
using AFBack.Features.MessageNotification.Models.Enum;
using AFBack.Models.Enums;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.MessageNotification.Repository;

public class MessageNotificationRepository(ApplicationDbContext context) : IMessageNotificationRepository
{
    // ============ MessageNotification ============
    
    // Sjekk interface for summary
    public async Task<Models.MessageNotification?> GetMessageNotificationAsync(string recipientId, string senderId,
        ConversationResponse conversationResponse)
        => await context.MessageNotifications
            .FirstOrDefaultAsync(mn => mn.RecipientId == recipientId &&
                                       mn.ConversationId == conversationResponse.Id &&
                                       !mn.IsRead &&
                                       mn.Type == MessageNotificationType.NewMessage &&
                                       (conversationResponse.Type == ConversationType.GroupChat ||
                                            mn.SenderId == senderId));
    
    // Sjekk interface for summary
    public async Task CreateMessageNotificationAsync(Models.MessageNotification notification)
    {
        await context.MessageNotifications.AddAsync(notification);
        await context.SaveChangesAsync();
    }
    
    // Sjekk interface for summary
    public async Task SaveMessageNotificationAsync() => await context.SaveChangesAsync();
    
    // ============ GroupEvent ============
    
    // Sjekk interface for summary
    public async Task<Models.MessageNotification?> GetUnreadGroupEventNotificationAsync(string recipientId, 
        int conversationId) 
        => await context.MessageNotifications
            .FirstOrDefaultAsync(n => n.RecipientId == recipientId
                                      && n.ConversationId == conversationId
                                      && n.Type == MessageNotificationType.GroupEvent
                                      && !n.IsRead);
    
    // Sjekk interface for summary
    public async Task CreateGroupEventAsync(GroupEvent groupEvent)
    {
        await context.GroupEvents.AddAsync(groupEvent);
        await context.SaveChangesAsync();
    }
    
    // Sjekk interface for summary
    public async Task<GroupEvent?> GetLastGroupEventForNotificationAsync(int notificationId)
        => await context.MessageNotificationGroupEvents
            .Where(mge => mge.MessageNotificationId == notificationId)
            .OrderByDescending(mge => mge.GroupEvent.CreatedAt)
            .Select(mge => mge.GroupEvent)
            .FirstOrDefaultAsync();
    
    // Sjekk interface for summary
    public async Task<List<GroupEvent>> GetGroupEventsForNotificationAsync(int notificationId)
        => await context.MessageNotificationGroupEvents
            .Where(mge => mge.MessageNotificationId == notificationId)
            .OrderByDescending(mge => mge.GroupEvent.CreatedAt)
            .Take(ApplicationConstants.Groups.MaxEventsPerNotification)
            .Select(mge => mge.GroupEvent)
            .ToListAsync();
    
    // ============ MessageNotificationGroupEvent ============
    
    // Sjekk interface for summary
    public async Task CreateMessageNotificationGroupEventAsync(MessageNotificationGroupEvent 
        messageNotificationGroupEvent)
    {
        await context.MessageNotificationGroupEvents.AddAsync(messageNotificationGroupEvent);
        await context.SaveChangesAsync();
    }
}
