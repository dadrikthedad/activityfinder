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
    
    public async Task<MessageNotificationDTO> CreateMessageReactionNotificationAsync(
        int reactingUserId,
        int receiverUserId,
        int messageId,
        int conversationId,
        string emoji)
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

        // Hent med relasjoner for mapping hvis nødvendig
        var created = await _context.MessageNotifications
            .Include(n => n.FromUser)
            .Include(n => n.Conversation)
            .Include(n => n.Message)
                .ThenInclude(m => m.Reactions) 
            .FirstOrDefaultAsync(n => n.Id == notification.Id);

        return MapToDTO(created!); // Du har MapToDTO allerede
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