using AFBack.Features.Conversation.DTOs;
using AFBack.Features.MessageNotification.DTOs;
using AFBack.Features.MessageNotification.Extensions;
using AFBack.Features.MessageNotification.Repository;
using AFBack.Features.Messaging.DTOs.Response;
using AFBack.Features.SyncEvents.Enums;
using AFBack.Features.SyncEvents.Services;
using AFBack.Models;
using AFBack.Models.Enums;
using AFBack.Services;

namespace AFBack.Features.MessageNotification.Service;

public class MessageNotificationService(
    ILogger<MessageNotificationService> logger,
    GroupNotificationService groupNotificationService,
    ISyncService syncService,
    IMessageNotificationRepository messageNotificationService) : IMessageNotificationService
{
    private readonly int _previewMessageLength = 40;
    
    // Sjekk interface for summary
    public async Task CreateNewMessageNotificationAsync(
        string recipientId,
        string senderId,
        ConversationResponse conversationResponse,
        MessageResponse messageResponse)
    {
        // Henter en eksisterende MessageNotification hvis det eksisterer en
        var existingMessageNotification = await messageNotificationService.GetMessageNotificationAsync(recipientId,
            senderId, conversationResponse);

        Models.MessageNotification messageNotification;
        
        // Hvis den eksisterere så oppdaterer vi feltene for å bygge en ny, oppdatert melding
        if (existingMessageNotification != null)
        {
            existingMessageNotification.MessageCount++; // Øker antall meldinger i en notifikasjon
            existingMessageNotification.LastUpdatedAt = DateTime.UtcNow; // Opptadeterer tiden
            existingMessageNotification.MessageId = messageResponse.Id; // Endrer nå til nyeste melding for å vise riktig Id
            existingMessageNotification.SenderId = senderId; // Nyeste avsender for å vise riktig navn i Gruppe
            
            await messageNotificationService.SaveMessageNotificationAsync();
            messageNotification = existingMessageNotification;
        }
        else
        {
            // Oppretter en ny notificaiton
            var notification = new Models.MessageNotification
            {
                RecipientId = recipientId,
                SenderId = senderId,
                MessageId = messageResponse.Id,
                ConversationId = conversationResponse.Id,
                Type = MessageNotificationType.NewMessage,
                CreatedAt = DateTime.UtcNow,
                LastUpdatedAt = DateTime.UtcNow
            };
            
            // Lagrer den i databasen
            await messageNotificationService.CreateMessageNotificationAsync(notification);
            messageNotification = notification;
        }
        
        // Bygger en NotificaitonResponse med en preview for syncevent
        var messageNotificationResponse = BuildNotificationResponse(messageNotification, conversationResponse,
            messageResponse);

        await syncService.CreateSyncEventsAsync(
            new List<string> {recipientId}, 
            SyncEventType.MessageNotificationCreated,
            messageNotificationResponse);
    }
    
    
    // Sjekk interface for summary
    public async Task CreatePendingConversationNotificationAsync(string recipientId, string senderId,
        ConversationResponse conversationResponse, MessageResponse messageResponse)
    {
        
        var notification = new Models.MessageNotification
        {
            RecipientId = recipientId,
            SenderId = senderId,
            MessageId = messageResponse.Id,
            ConversationId = conversationResponse.Id,
            Type = MessageNotificationType.MessageRequest,
            CreatedAt = DateTime.UtcNow,
            LastUpdatedAt = DateTime.UtcNow,
        };

        await messageNotificationService.CreateMessageNotificationAsync(notification);
        
        var preview = $"{messageResponse.Sender!.FullName} wants to message you";
        
        var messageNotificationResponse = notification.ToResponse(conversationResponse, messageResponse, preview);

        await syncService.CreateSyncEventsAsync(
            new List<string> {recipientId}, 
            SyncEventType.MessageNotificationCreated,
            messageNotificationResponse);
    }
    
    
    /// <summary>
    /// Bygger en MessageNotificationResponse for SyncEvent med en tilpasset MessagePreview utifra eksisterende og
    /// 1-1 eller gruppesamtale
    /// </summary>
    /// <param name="notification">Notifikasjonen vi opprettet</param>
    /// <param name="conversationResponse">Samtalen med participants</param>
    /// <param name="messageResponse">Meldingen</param>
    /// <returns>MessageNotificationResponse ferdig for frontend</returns>
    private MessageNotificationResponse BuildNotificationResponse(Models.MessageNotification notification,
        ConversationResponse conversationResponse,
        MessageResponse messageResponse)
    {
        // En preview til å vise i toast/notifikasjonsvindu lages her i Preview
        string preview;
        var messageCount = notification.MessageCount;

        if (messageCount == 1)
        {
            preview = BuildPreviewIfFirstMessageNotification(messageResponse.SenderId!, messageResponse.EncryptedText,
                messageResponse.EncryptedAttachments.Count, conversationResponse.Type, conversationResponse.GroupName);
        }
        else
            preview = conversationResponse.Type != ConversationType.GroupChat
                ? $"has sent you {messageCount} messages"
                : $"There are {messageCount} new messages in {conversationResponse.GroupName}";


        return notification.ToResponse(conversationResponse, messageResponse, preview);
    }
    
    /// <summary>
    /// Bygger en preview for å vise en tekst i frontend sin toast og notifikasjonsvindu
    /// </summary>
    /// <param name="senderId">Brukeren sendte meldingen</param>
    /// <param name="messageText">Meldingen som gjøres om til en preview</param>
    /// <param name="numberOfAttachments">Vise en melding for antall attachments hvis det er ingen tekst i melding</param>
    /// <param name="conversationType">Skille mellom 1-1 og gruppe</param>
    /// <param name="groupName">Vise gruppenavn ved siden av avsender i preview</param>
    /// <returns></returns>
    private string BuildPreviewIfFirstMessageNotification(string senderId, string? messageText, int numberOfAttachments,
        ConversationType conversationType, string? groupName)
    {
        if (string.IsNullOrEmpty(messageText) && numberOfAttachments == 0)
        {
            logger.LogCritical("User {UserId} has somehow sent a message without text", senderId);
            return "has somehow sent an empty message";
        }
        
        if (!string.IsNullOrEmpty(messageText))
        {
            var msgPreview = messageText.Length > _previewMessageLength 
                ? messageText.Substring(0, _previewMessageLength) + "..." 
                : messageText;

            return conversationType != ConversationType.GroupChat
                ? $"said: {msgPreview}"
                : $"sent to {groupName}: {msgPreview}";
        }

        var attachmentText = numberOfAttachments == 1
            ? "1 attachment"
            : $"{numberOfAttachments} attachments";

        return conversationType != ConversationType.GroupChat
            ? $"sent {attachmentText}"
            : $"sent {attachmentText} to {groupName}";
    }
    
    public async Task<MessageNotificationDTO> CreateMessageRequestApprovedNotificationAsync(
        int approverId,
        int senderId,
        int conversationId)
    {
        var notification = new Models.MessageNotification
        {
            RecipientId = senderId,
            SenderId = approverId,
            ConversationId = conversationId,
            Type = NotificationType.MessageRequestApproved,
            CreatedAt = DateTime.UtcNow,
            IsRead = false
        };

        context.MessageNotifications.Add(notification);
        await context.SaveChangesAsync();

        var created = await context.MessageNotifications
            .Include(n => n.FromUser)
                .ThenInclude(u => u.UserProfile)
            .Include(n => n.Conversation)
            .FirstOrDefaultAsync(n => n.Id == notification.Id);

        var dto = MapToDto(created!);
    
        // Automatically queue sync event
        notificationSyncService.QueueNotificationSyncEvent(dto, senderId);
        
        return dto;
    }
    
    public async Task<MessageNotificationDTO> CreateMessageReactionNotificationAsync(
        int reactingUserId,
        int receiverUserId,
        int messageId,
        int conversationId,
        string emoji)
    {
        // 🔍 Sjekk om det finnes en eksisterende notifikasjon
        var existing = await context.MessageNotifications
            .Include(n => n.Message)
            .Include(n => n.FromUser)
                .ThenInclude(u => u.UserProfile)
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

            await context.SaveChangesAsync();
            return MapToDto(existing, isUpdate: true);
        }

        // ✨ Ny notifikasjon hvis ingen finnes
        var notification = new Models.MessageNotification
        {
            RecipientId = receiverUserId,
            SenderId = reactingUserId,
            Type = NotificationType.MessageReaction,
            MessageId = messageId,
            ConversationId = conversationId,
            CreatedAt = DateTime.UtcNow,
            IsRead = false
        };

        context.MessageNotifications.Add(notification);
        await context.SaveChangesAsync();

        var created = await context.MessageNotifications
            .Include(n => n.FromUser)
            .ThenInclude(u => u.UserProfile) 
            .Include(n => n.Conversation)
            .Include(n => n.Message!)
            .ThenInclude(m => m.Reactions)
            .FirstOrDefaultAsync(n => n.Id == notification.Id);

        var dto = MapToDto(created!);
    
        // Automatically queue sync event
        notificationSyncService.QueueNotificationSyncEvent(dto, receiverUserId);
    
        return dto;
    }
    
    public async Task<MessageNotificationDTO?> CreateGroupRequestNotificationAsync(
        int senderId, 
        int receiverId, 
        int conversationId,
        int groupRequestId,
        string groupName)
    {
        // Sjekk om det allerede finnes en ulest GroupRequest-notifikasjon
        var existing = await context.MessageNotifications
            .Include(n => n.FromUser)
            .ThenInclude(u => u.UserProfile)
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
        var notification = new Models.MessageNotification
        {
            RecipientId = receiverId,
            SenderId = senderId,
            ConversationId = conversationId,
            Type = NotificationType.GroupRequest,
            CreatedAt = DateTime.UtcNow,
            IsRead = false,
        };

        context.MessageNotifications.Add(notification);
        await context.SaveChangesAsync();

        // Hent den opprettede notifikasjonen med alle includes
        var created = await context.MessageNotifications
            .Include(n => n.FromUser)
            .ThenInclude(u => u.UserProfile)
            .Include(n => n.Conversation)
            .FirstOrDefaultAsync(n => n.Id == notification.Id);

        var dto = MapToDto(created!);
    
        // Automatically queue sync event
        notificationSyncService.QueueNotificationSyncEvent(dto, receiverId);
    
        return dto;
    }
    
    
    public MessageNotificationDTO MapToDto(Models.MessageNotification n, HashSet<int>? rejectedConversations = null, bool isUpdate = false)
    {
        string preview;
        
        var displayCount = n.Type == NotificationType.GroupEvent 
            ? (n.EventCount ?? 0)    // For GroupEvent: bruk EventCount
            : (n.MessageCount ?? 0);

        switch (n.Type)
        {
            case NotificationType.MessageRequestApproved:
                preview = "approved your message request";
                break;
            
            case NotificationType.GroupRequestApproved:
                if (displayCount > 1)
                {
                    // Flere medlemmer har blitt med
                    if (displayCount == 2)
                    {
                        preview = $"and 1 other person have joined \"{n.Conversation?.GroupName}\"";
                    }
                    else
                    {
                        preview = $"and {displayCount - 1} others have joined \"{n.Conversation?.GroupName}\"";
                    }
                }
                else
                {
                    // Første medlem som blir med
                    preview = $"has joined \"{n.Conversation?.GroupName}\"";
                }
                break;
            
            
            case NotificationType.GroupRequestInvited: 
                if (displayCount > 1)
                {
                    // Flere brukere invitert
                    preview = $"invited {displayCount} people to join \"{n.Conversation?.GroupName}\"";
                }
                else
                {
                    // Én bruker invitert
                    preview = $"invited someone to join \"{n.Conversation?.GroupName}\"";
                }
                break;
            
            case NotificationType.GroupEvent: 
                if (displayCount > 1)
                {
                    preview = $"There are {displayCount} new activities in \"{n.Conversation?.GroupName}\"";
                }
                else
                {
                    preview = $"New activity in \"{n.Conversation?.GroupName}\"";
                }
                break;


            case NotificationType.MessageRequest:
                preview = "requested to message you";
                break;
            
            
            
            case NotificationType.GroupRequest: 
                preview = $"invited you to join \"{n.Conversation?.GroupName}\"";
                break;
            
            case NotificationType.GroupDisbanded:
                preview = $"Group \"{n.Conversation?.GroupName}\" has been disbanded";
                break;

            case NotificationType.MessageReaction:
                preview = n.Message?.EncryptedText?.Length > 40
                    ? n.Message.EncryptedText.Substring(0, 40) + "..."
                    : n.Message?.EncryptedText ?? "";
                break;

            case NotificationType.NewMessage:
                if (n.Conversation?.IsGroup == true)
                {
                    // Gruppemeldinger
                    if (displayCount > 1)
                    {
                        // Flere meldinger: UTEN sender-navn
                        preview = $"There are {displayCount} new messages in {n.Conversation.GroupName}";
                    }
                    else
                    {
                        // Første melding: MED sender-navn
                        var msgText = n.Message?.EncryptedText;
                        var msgPreview = msgText?.Length > 40 ? msgText.Substring(0, 40) + "..." : msgText ?? "";
                        preview = $"sent to {n.Conversation.GroupName}: {msgPreview}";
                    }
                }
                else
                {
                    // Private meldinger: UTEN sender-navn (frontend legger til med <strong>)
                    if (displayCount > 1)
                    {
                        preview = $"has sent you {displayCount} messages";
                    }
                    else
                    {
                        var msgText = n.Message?.EncryptedText;
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
            SenderName = n.SenderUser?.FullName,
            SenderId = n.SenderId,
            SenderProfileImageUrl = n.SenderUser?.ProfileImageUrl, 
            GroupName = n.Conversation?.GroupName,
            GroupImageUrl = n.Conversation?.GroupImageUrl,
            MessagePreview = preview,
            ReactionEmoji = n.Type == NotificationType.MessageReaction 
                ? n.Message?.Reactions?
                    .FirstOrDefault(r => r.UserId == n.SenderId)?.Emoji 
                : null,
            MessageCount = n.MessageCount,
            IsConversationRejected = n.ConversationId.HasValue &&
                                     rejectedConversations != null &&
                                     rejectedConversations.Contains(n.ConversationId.Value),
            IsReactionUpdate = isUpdate,
            
            EventCount = n.EventCount,
            LastUpdatedAt = n.LastUpdatedAt,
            EventSummaries = n.Type == NotificationType.GroupEvent 
                ? null // Dette populeres i GroupNotificationService.ConvertToMessageNotificationDTOAsync
                : null,
        };
    }
    
    // I MessageNotificationService klassen
    public async Task<(List<MessageNotificationDTO> notifications, int totalCount)> GetUserNotificationsAsync(
        int userId, 
        int page = 1, 
        int pageSize = 20)
    {
        try
        {
            logger.LogDebug("🔍 Getting notifications for appUser {UserId} - Page: {Page}, PageSize: {PageSize}", 
                userId, page, pageSize);

            // Valider input
            if (page < 1 || pageSize <= 0)
            {
                throw new ArgumentException("Invalid pagination values");
            }

            // 1️⃣ Tell totale antall notifications (nå kun fra MessageNotifications tabellen)
            var totalCount = await context.MessageNotifications
                .Where(n => n.UserId == userId)
                .CountAsync();

            // 2️⃣ Hent alle notifications inkludert GroupEvent notifikasjoner
            var messageNotifications = await context.MessageNotifications
                .Where(n => n.UserId == userId)
                .Include(n => n.FromUser)
                .ThenInclude(u => u.UserProfile)
                .Include(n => n.Message!)
                .ThenInclude(m => m.Reactions)
                .Include(n => n.Conversation)
                .Include(n => n.GroupEvents) // 🆕 LEGG TIL DENNE LINJEN
                .OrderByDescending(n => n.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            // 3️⃣ Bygg rejected conversation set
            var conversationIds = messageNotifications
                .Where(n => n.ConversationId.HasValue)
                .Select(n => n.ConversationId!.Value)
                .Distinct()
                .ToList();

            var rejectedMessageConversations = await context.MessageRequests
                .Where(r =>
                    conversationIds.Contains(r.ConversationId!.Value) &&
                    r.ReceiverId == userId &&
                    r.IsRejected)
                .Select(r => r.ConversationId!.Value)
                .Distinct()
                .ToListAsync();

            var rejectedGroupConversations = await context.GroupRequests
                .Where(gr =>
                    conversationIds.Contains(gr.ConversationId) &&
                    gr.ReceiverId == userId &&
                    gr.Status == GroupRequestStatus.Rejected)
                .Select(gr => gr.ConversationId)
                .Distinct()
                .ToListAsync();

            var rejectedConversationSet = new HashSet<int>(
                rejectedMessageConversations.Concat(rejectedGroupConversations)
            );

            // 4️⃣ Konverter alle notifikasjoner til DTO format
            var allNotificationDTOs = new List<MessageNotificationDTO>();

            foreach (var notification in messageNotifications)
            {
                MessageNotificationDTO dto;
                
                if (notification.Type == NotificationType.GroupEvent)
                {
                    // 🆕 Bruk GroupNotificationService for GroupEvent notifikasjoner
                    dto = await groupNotificationService.ConvertToMessageNotificationDTOAsync(notification);
                }
                else
                {
                    // Vanlige notifikasjoner
                    dto = MapToDto(notification, rejectedConversationSet);
                }
                
                allNotificationDTOs.Add(dto);
            }

            logger.LogDebug("✅ Retrieved {NotificationCount} notifications out of {TotalCount} total", 
                allNotificationDTOs.Count, totalCount);

            return (allNotificationDTOs, totalCount);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "❌ Failed to get notifications for appUser {UserId}", userId);
            throw; // Re-throw for proper error handling
        }
    }
    
    
}
