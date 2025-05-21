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
    
    public async Task<MessageNotificationDTO?> CreateMessageRequestNotificationAsync(int senderId, int receiverId, int conversationId)
    {
        var existing = await _context.MessageNotifications
            .Include(n => n.FromUser)
            .Include(n => n.Conversation)
            .FirstOrDefaultAsync(n =>
                n.UserId == receiverId &&
                n.FromUserId == senderId &&
                n.ConversationId == conversationId &&
                n.Type == NotificationType.MessageRequest &&
                !n.IsRead);

        if (existing != null)
        {
            return null; // Allerede sendt – ikke send igjen
        }

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

        var created = await _context.MessageNotifications
            .Include(n => n.FromUser)
            .Include(n => n.Conversation)
            .FirstOrDefaultAsync(n => n.Id == notification.Id);

        return MapToDTO(created!);
    }
    
    public async Task<MessageNotificationDTO> CreateMessageRequestApprovedNotificationAsync(
        int approverId,
        int senderId,
        int conversationId)
    {
        var notification = new MessageNotification
        {
            UserId = senderId,
            FromUserId = approverId,
            ConversationId = conversationId,
            Type = NotificationType.MessageRequestApproved,
            CreatedAt = DateTime.UtcNow,
            IsRead = false
        };

        _context.MessageNotifications.Add(notification);
        await _context.SaveChangesAsync();

        var created = await _context.MessageNotifications
            .Include(n => n.FromUser)
            .Include(n => n.Conversation)
            .FirstOrDefaultAsync(n => n.Id == notification.Id);

        return MapToDTO(created!);
    }
    
    public async Task<MessageNotificationDTO> CreateMessageReactionNotificationAsync(
        int reactingUserId,
        int receiverUserId,
        int messageId,
        int conversationId,
        string emoji)
    {
        // 🔍 Sjekk om det finnes en eksisterende notifikasjon
        var existing = await _context.MessageNotifications
            .Include(n => n.Message)
            .Include(n => n.FromUser)
            .Include(n => n.Conversation)
            .Where(n =>
                n.UserId == receiverUserId &&
                n.Type == NotificationType.MessageReaction &&
                n.MessageId == messageId &&
                n.FromUserId == reactingUserId)
            .FirstOrDefaultAsync();

        if (existing != null)
        {
            // 🔁 Oppdater timestamp og mark as unread
            existing.CreatedAt = DateTime.UtcNow;
            existing.IsRead = false;

            await _context.SaveChangesAsync();
            return MapToDTO(existing);
        }

        // ✨ Ny notifikasjon hvis ingen finnes
        var notification = new MessageNotification
        {
            UserId = receiverUserId,
            FromUserId = reactingUserId,
            Type = NotificationType.MessageReaction,
            MessageId = messageId,
            ConversationId = conversationId,
            CreatedAt = DateTime.UtcNow,
            IsRead = false
        };

        _context.MessageNotifications.Add(notification);
        await _context.SaveChangesAsync();

        var created = await _context.MessageNotifications
            .Include(n => n.FromUser)
            .Include(n => n.Conversation)
            .Include(n => n.Message!)
            .ThenInclude(m => m.Reactions)
            .FirstOrDefaultAsync(n => n.Id == notification.Id);

        return MapToDTO(created!);
    }
    
    private MessageNotificationDTO MapToDTO(MessageNotification n)
    {
        return new MessageNotificationDTO
        {
            Id = n.Id,
            Type = n.Type,
            CreatedAt = n.CreatedAt,
            IsRead = n.IsRead,
            ReadAt = n.ReadAt,
            MessageId = n.MessageId,
            ConversationId = n.ConversationId,
            SenderName = n.FromUser?.FullName,
            SenderId = n.FromUserId,   
            GroupName = n.Conversation?.GroupName,
            MessagePreview = n.Message?.Text?.Length > 40 
                ? n.Message.Text.Substring(0, 40) + "..."
                : n.Message?.Text,
            ReactionEmoji = n.Type == NotificationType.MessageReaction ? n.Message?.Reactions?
                .FirstOrDefault(r => r.UserId == n.FromUserId)?.Emoji : null
        };
    }
}