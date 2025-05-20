using AFBack.Data;
using AFBack.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Services;

public class MessageNotificationService
{
    private readonly ApplicationDbContext _context;

    public MessageNotificationService(ApplicationDbContext context)
    {
        _context = context;
    }
    
    public async Task CreateMessageNotificationAsync(int recipientUserId, int senderUserId, int conversationId, int messageId)
    {
        var notification = new MessageNotification
        {
            UserId = recipientUserId,
            FromUserId = senderUserId,
            Type = NotificationType.NewMessage,
            MessageId = messageId,
            ConversationId = conversationId,
            CreatedAt = DateTime.UtcNow,
            IsRead = false
        };

        _context.MessageNotifications.Add(notification);
        await _context.SaveChangesAsync();
    }
    
    public async Task CreateMessageRequestNotificationAsync(int senderId, int receiverId, int conversationId)
    {
        var alreadyExists = await _context.MessageNotifications.AnyAsync(n =>
            n.UserId == receiverId &&
            n.FromUserId == senderId &&
            n.ConversationId == conversationId &&
            n.Type == NotificationType.MessageRequest &&
            !n.IsRead);

        if (!alreadyExists)
        {
            var notification = new MessageNotification
            {
                UserId = receiverId,
                FromUserId = senderId,
                ConversationId = conversationId,
                Type = NotificationType.MessageRequest,
                CreatedAt = DateTime.UtcNow,
                IsRead = false
            };

            _context.MessageNotifications.Add(notification);
            await _context.SaveChangesAsync();
        }
    }
    
    public async Task CreateMessageRequestApprovedNotificationAsync(int approverId, int senderId, int conversationId)
    {
        var notification = new MessageNotification
        {
            UserId = senderId, // Mottakeren av varselet er den som opprinnelig sendte meldingsforespørselen
            FromUserId = approverId, // Den som godkjente
            ConversationId = conversationId,
            Type = NotificationType.MessageRequestApproved,
            CreatedAt = DateTime.UtcNow,
            IsRead = false
        };

        _context.MessageNotifications.Add(notification);
        await _context.SaveChangesAsync();
    }
    
    public async Task CreateMessageReactionNotificationAsync(int reactingUserId, int receiverUserId, int messageId, int conversationId, string emoji)
    {
        var notification = new MessageNotification
        {
            UserId = receiverUserId,
            FromUserId = reactingUserId,
            Type = NotificationType.MessageReaction,
            MessageId = messageId,
            ConversationId = conversationId,
            CreatedAt = DateTime.UtcNow,
            IsRead = false,
        };

        _context.MessageNotifications.Add(notification);
        await _context.SaveChangesAsync();
    }
}