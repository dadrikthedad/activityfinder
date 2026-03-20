using AFBack.Common;
using AFBack.Data;
using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.Conversation.Enums;
using AFBack.Features.MessageNotification.Models;
using AFBack.Features.MessageNotification.Models.Enum;
using AFBack.Features.MessageNotifications.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.MessageNotifications.Repository;

public class MessageNotificationRepository(AppDbContext context) : IMessageNotificationRepository
{
    // ============ MessageNotification ============
    
    /// <inheritdoc />
    public async Task<MessageNotifications.Models.MessageNotification?> GetMessageNotificationAsync(int messageNotificationId)
        => await context.MessageNotifications.FirstOrDefaultAsync(mn => mn.Id == messageNotificationId);
    
    /// <inheritdoc />
    public async Task<MessageNotifications.Models.MessageNotification?> GetMessageNotificationWithConversationAsync(int messageNotificationId)
        => await context.MessageNotifications
            .Include(mn => mn.Conversation)
            .FirstOrDefaultAsync(mn => mn.Id == messageNotificationId);
    
    /// <inheritdoc />
    public async Task<List<Models.MessageNotification>> GetMessageNotificationsForConversationAsync(
        string userId, int conversationId) 
        => await context.MessageNotifications
            .AsNoTracking()
            .Where(mn => mn.RecipientId == userId && mn.ConversationId == conversationId)
            .OrderByDescending(mn => mn.LastUpdatedAt ?? mn.CreatedAt)
            .ToListAsync();
    
    
    /// <inheritdoc />
    public async Task<MessageNotifications.Models.MessageNotification?> GetMessageNotificationWithSenderIdAsync(
        string recipientId, string senderId, ConversationResponse conversationResponse) => 
        await context.MessageNotifications
            .FirstOrDefaultAsync(mn => mn.RecipientId == recipientId &&
                                       mn.ConversationId == conversationResponse.Id &&
                                       !mn.IsRead &&
                                       mn.Type == MessageNotificationType.NewMessage &&
                                       (conversationResponse.Type == ConversationType.GroupChat ||
                                            mn.SenderId == senderId));
    
    /// <inheritdoc />
    public async Task<Models.MessageNotification?> GetReactionNotificationAsync(
        string recipientId, int messageId) =>
        await context.MessageNotifications
            .FirstOrDefaultAsync(mn =>
                mn.RecipientId == recipientId &&
                mn.MessageId == messageId &&
                !mn.IsRead &&
                mn.Type == MessageNotificationType.MessageReaction);
    
    /// <inheritdoc />
    public async Task<int> GetUnreadCountAsync(string userId) => await context.MessageNotifications
            .CountAsync(mn => mn.RecipientId == userId && !mn.IsRead);
    
    /// <inheritdoc />
    public async Task<List<int>> GetUnreadConversationIdsAsync(string userId) => 
        await context.MessageNotifications
            .Where(n => n.RecipientId == userId && !n.IsRead)
            .Select(n => n.ConversationId)
            .Distinct()
            .ToListAsync();
    
    /// <inheritdoc />
    public async Task<List<MessageNotifications.Models.MessageNotification>> 
        GetUnreadMessageNotificationsForConversationAsync(string userId, int conversationId) 
        => await context.MessageNotifications
            .Where(mn => mn.RecipientId == userId 
                         && mn.ConversationId == conversationId 
                         && !mn.IsRead)
            .ToListAsync();
    
    /// <inheritdoc />
    public async Task<List<MessageNotifications.Models.MessageNotification>> GetAllUnreadNotificationsAsync(string userId) 
        => await context.MessageNotifications
            .Where(mn => mn.RecipientId == userId && !mn.IsRead)
            .ToListAsync();
    
    /// <inheritdoc />
    public async Task CreateMessageNotificationAsync(MessageNotifications.Models.MessageNotification notification)
    {
        await context.MessageNotifications.AddAsync(notification);
        await context.SaveChangesAsync();
    }
    
    /// <inheritdoc />
    public async Task DeleteMessageNotificationAsync(Models.MessageNotification notification)
    {
        context.MessageNotifications.Remove(notification);
        await context.SaveChangesAsync();
    }

    /// <inheritdoc />
    public async Task DeleteAllMessageNotificationsAsync(string userId) =>
        await context.MessageNotifications
            .Where(mn => mn.RecipientId == userId)
            .ExecuteDeleteAsync();
    
    
    /// <inheritdoc />
    public async Task SaveMessageNotificationAsync() => await context.SaveChangesAsync();
    
    // ============ GroupEvent ============
    
    /// <inheritdoc />
    public async Task<MessageNotifications.Models.MessageNotification?> GetUnreadGroupEventNotificationAsync(
        string recipientId, int conversationId) => await context.MessageNotifications
            .FirstOrDefaultAsync(n => n.RecipientId == recipientId
                                      && n.ConversationId == conversationId
                                      && n.Type == MessageNotificationType.GroupEvent
                                      && !n.IsRead);
    
    /// <inheritdoc />
    public async Task<MessageNotifications.Models.MessageNotification?> GetLatestGroupEventNotificationAsync(
        string recipientId, int conversationId) => await context.MessageNotifications
        .Where(n => n.RecipientId == recipientId
                    && n.ConversationId == conversationId
                    && n.Type == MessageNotificationType.GroupEvent)
        .OrderByDescending(n => n.LastUpdatedAt)
        .FirstOrDefaultAsync();
    
    /// <inheritdoc />
    public async Task CreateGroupEventAsync(GroupEvent groupEvent)
    {
        await context.GroupEvents.AddAsync(groupEvent);
        await context.SaveChangesAsync();
    }
    
    /// <inheritdoc />
    public async Task<List<GroupEvent>> GetGroupEventsForNotificationAsync(int notificationId)
        => await context.MessageNotificationGroupEvents
            .Where(mge => mge.MessageNotificationId == notificationId)
            .OrderByDescending(mge => mge.GroupEvent.CreatedAt)
            .Take(ApplicationConstants.Groups.MaxEventsPerNotification)
            .Select(mge => mge.GroupEvent)
            .ToListAsync();
    
    // ============ MessageNotificationGroupEvent ============
    
    /// <inheritdoc />
    public async Task CreateMessageNotificationGroupEventAsync(MessageNotificationGroupEvent 
        messageNotificationGroupEvent)
    {
        await context.MessageNotificationGroupEvents.AddAsync(messageNotificationGroupEvent);
        await context.SaveChangesAsync();
    }
    
    // ============ Paginering ============
    
    /// <inheritdoc />
    public async Task<(List<MessageNotifications.Models.MessageNotification> Items, int TotalCount)> GetPaginatedNotificationsAsync(
        string userId, int page, int pageSize)
    {
        // Oppretter først queryen
        var query = context.MessageNotifications
            .Where(mn => mn.RecipientId == userId)
            .Include(mn => mn.Conversation)
            .OrderByDescending(mn => mn.LastUpdatedAt ?? mn.CreatedAt);
        
        // Henter totalt antall
        var totalCount = await query.CountAsync();
        
        // Utfører queryen med pagineringen
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, totalCount);
    }
    
    /// <inheritdoc />
    public async Task<List<(int MessageNotificationId, GroupEvent GroupEvent)>> GetGroupEventsForNotificationsAsync(
        List<int> notificationIds) => await context.MessageNotificationGroupEvents
        .Where(mge => notificationIds.Contains(mge.MessageNotificationId))
        .OrderByDescending(mge => mge.GroupEvent.CreatedAt)
        .Select(mge => new ValueTuple<int, GroupEvent>(
            mge.MessageNotificationId, 
            mge.GroupEvent))
        .ToListAsync();
    
    
        
    
}
