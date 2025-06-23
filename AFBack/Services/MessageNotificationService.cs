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
        // Hent conversation info for å bestemme type melding
        var conversation = await _context.Conversations
            .Where(c => c.Id == conversationId)
            .Select(c => new { c.IsGroup, c.GroupName })
            .FirstOrDefaultAsync();

        if (conversation == null) return;

        // For grupper: finn eksisterende notification basert på conversationId (ikke senderId)
        MessageNotification? existingNotification = null;
        
        if (conversation.IsGroup)
        {
            // For grupper: samle alle meldinger fra samme gruppe
            existingNotification = await _context.MessageNotifications
                .FirstOrDefaultAsync(n =>
                    n.UserId == recipientUserId &&
                    n.ConversationId == conversationId &&
                    !n.IsRead &&
                    n.Type == NotificationType.NewMessage);
        }
        else
        {
            // For 1-1 samtaler: gruppér per sender
            existingNotification = await _context.MessageNotifications
                .FirstOrDefaultAsync(n =>
                    n.UserId == recipientUserId &&
                    n.FromUserId == senderUserId &&
                    n.ConversationId == conversationId &&
                    !n.IsRead &&
                    n.Type == NotificationType.NewMessage);
        }

        if (existingNotification != null)
        {
            // Oppdater eksisterende notification
            existingNotification.MessageCount = (existingNotification.MessageCount ?? 1) + 1;
            existingNotification.CreatedAt = DateTime.UtcNow;
            existingNotification.MessageId = messageId; // Oppdater til nyeste melding
            existingNotification.FromUserId = senderUserId;
            
        }
        else
        {
            // Opprett ny notification
            var notification = new MessageNotification
            {
                UserId = recipientUserId,
                FromUserId = senderUserId,
                Type = NotificationType.NewMessage,
                MessageId = messageId,
                ConversationId = conversationId,
                CreatedAt = DateTime.UtcNow,
                IsRead = false,
                MessageCount = 1
            };

            _context.MessageNotifications.Add(notification);
        }
        await _context.SaveChangesAsync();
    }
    
    public async Task<MessageNotificationDTO?> CreateMessageRequestNotificationAsync(int senderId, int receiverId, int conversationId)
    {
        var existing = await _context.MessageNotifications
            .Include(n => n.FromUser)
            .ThenInclude(u => u.Profile)
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
                .ThenInclude(u => u.Profile)
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
                .ThenInclude(u => u.Profile)
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
                .ThenInclude(u => u.Profile)
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

            await _context.SaveChangesAsync();
            return MapToDTO(existing, isUpdate: true);
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
            .ThenInclude(u => u.Profile) 
            .Include(n => n.Conversation)
            .Include(n => n.Message!)
            .ThenInclude(m => m.Reactions)
            .FirstOrDefaultAsync(n => n.Id == notification.Id);

        return MapToDTO(created!);
    }
    
    public async Task<MessageNotificationDTO?> CreateGroupRequestNotificationAsync(
        int senderId, 
        int receiverId, 
        int conversationId,
        int groupRequestId,
        string groupName)
    {
        // Sjekk om det allerede finnes en ulest GroupRequest-notifikasjon
        var existing = await _context.MessageNotifications
            .Include(n => n.FromUser)
            .ThenInclude(u => u.Profile)
            .Include(n => n.Conversation)
            .FirstOrDefaultAsync(n =>
                n.UserId == receiverId &&
                n.FromUserId == senderId &&
                n.ConversationId == conversationId &&
                n.Type == NotificationType.GroupRequest &&
                !n.IsRead);

        if (existing != null)
        {
            return null; // Allerede sendt – ikke send igjen
        }

        // Opprett ny GroupRequest-notifikasjon
        var notification = new MessageNotification
        {
            UserId = receiverId,
            FromUserId = senderId,
            ConversationId = conversationId,
            Type = NotificationType.GroupRequest,
            CreatedAt = DateTime.UtcNow,
            IsRead = false,
        };

        _context.MessageNotifications.Add(notification);
        await _context.SaveChangesAsync();

        // Hent den opprettede notifikasjonen med alle includes
        var created = await _context.MessageNotifications
            .Include(n => n.FromUser)
            .ThenInclude(u => u.Profile)
            .Include(n => n.Conversation)
            .FirstOrDefaultAsync(n => n.Id == notification.Id);

        return MapToDTO(created!);
    }
    
    public async Task<MessageNotificationDTO> CreateGroupRequestApprovedNotificationAsync(
        int approverId,
        int senderId,
        int conversationId)
    {
        var notification = new MessageNotification
        {
            UserId = senderId,
            FromUserId = approverId,
            ConversationId = conversationId,
            Type = NotificationType.GroupRequestApproved, // ✅ Ny type
            CreatedAt = DateTime.UtcNow,
            IsRead = false
        };

        _context.MessageNotifications.Add(notification);
        await _context.SaveChangesAsync();

        var created = await _context.MessageNotifications
            .Include(n => n.FromUser)
            .ThenInclude(u => u.Profile)
            .Include(n => n.Conversation)
            .FirstOrDefaultAsync(n => n.Id == notification.Id);

        return MapToDTO(created!);
    }
    
    public MessageNotificationDTO MapToDTO(MessageNotification n, HashSet<int>? rejectedConversations = null, bool isUpdate = false)
    {
        string preview;
        var messageCount = n.MessageCount ?? 0;

        switch (n.Type)
        {
            case NotificationType.MessageRequestApproved:
                preview = "approved your message request";
                break;
            
            case NotificationType.GroupRequestApproved: // ✅ Legg til denne
                preview = $"joined your group \"{n.Conversation?.GroupName}\"";
                break;

            case NotificationType.MessageRequest:
                preview = "requested to message you";
                break;
            
            
            
            case NotificationType.GroupRequest: // 🆕 Legg til denne
                preview = $"invited you to join \"{n.Conversation?.GroupName}\"";
                break;

            case NotificationType.MessageReaction:
                preview = n.Message?.Text?.Length > 40
                    ? n.Message.Text.Substring(0, 40) + "..."
                    : n.Message?.Text ?? "";
                break;

            case NotificationType.NewMessage:
                if (n.Conversation?.IsGroup == true)
                {
                    // Gruppemeldinger
                    if (messageCount > 1)
                    {
                        // Flere meldinger: UTEN sender-navn
                        preview = $"There are {messageCount} new messages in {n.Conversation.GroupName}";
                    }
                    else
                    {
                        // Første melding: MED sender-navn
                        var msgText = n.Message?.Text;
                        var msgPreview = msgText?.Length > 40 ? msgText.Substring(0, 40) + "..." : msgText ?? "";
                        preview = $"sent to {n.Conversation.GroupName}: {msgPreview}";
                    }
                }
                else
                {
                    // Private meldinger: UTEN sender-navn (frontend legger til med <strong>)
                    if (messageCount > 1)
                    {
                        preview = $"has sent you {messageCount} messages";
                    }
                    else
                    {
                        var msgText = n.Message?.Text;
                        var msgPreview = msgText?.Length > 40 ? msgText.Substring(0, 40) + "..." : msgText ?? "";
                        preview = $"said: {msgPreview}";
                    }
                }
                break;


            default:
                preview = "You have a new notification";
                break;
        }

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
            SenderProfileImageUrl = n.FromUser?.Profile?.ProfileImageUrl, 
            GroupName = n.Conversation?.GroupName,
            GroupImageUrl = n.Conversation?.GroupImageUrl,
            MessagePreview = preview,
            ReactionEmoji = n.Type == NotificationType.MessageReaction 
                ? n.Message?.Reactions?
                    .FirstOrDefault(r => r.UserId == n.FromUserId)?.Emoji 
                : null,
            MessageCount = n.MessageCount,
            IsConversationRejected = n.ConversationId.HasValue &&
                                     rejectedConversations != null &&
                                     rejectedConversations.Contains(n.ConversationId.Value),
            IsReactionUpdate = isUpdate
        };
    }
}