using AFBack.Constants;
using AFBack.Data;
using AFBack.DTOs;
using AFBack.Hubs;
using AFBack.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Services;

public class MessageNotificationService
{
    private readonly ApplicationDbContext _context;
    private readonly IHubContext<UserHub> _hubContext; 
    private readonly ILogger<MessageNotificationService> _logger;
    private readonly GroupNotificationService _groupNotificationService;
    private readonly IBackgroundTaskQueue _taskQueue;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly NotificationSyncService _notificationSyncService;
    

    public MessageNotificationService(ApplicationDbContext context, IHubContext<UserHub> hubContext, ILogger<MessageNotificationService> logger, GroupNotificationService groupNotificationService, IBackgroundTaskQueue taskQueue, IServiceScopeFactory scopeFactory, NotificationSyncService notificationSyncService)
    {
        _context = context;
        _hubContext = hubContext;
        _logger = logger;
        _groupNotificationService = groupNotificationService;
        _taskQueue = taskQueue;
        _scopeFactory = scopeFactory;
        _notificationSyncService = notificationSyncService;
    }
    
    public async Task<MessageResponseDTO> CreateSystemMessageAsync(int conversationId, string messageText, List<int>? excludeUserIds = null)
    {
        _logger.LogInformation("🔍 SYSTEM_MESSAGE: Creating system message for conversation {ConversationId}: {MessageText}", 
            conversationId, messageText);
        
        var systemMessage = new Message
        {
            ConversationId = conversationId,
            SenderId = null,
            EncryptedText = messageText,
            IsSystemMessage = true,
            SentAt = DateTime.UtcNow,
            IsApproved = true
        };

        _context.Messages.Add(systemMessage);

        // Oppdater samtalen
        var conversation = await _context.Conversations
            .Include(c => c.Participants)
            .FirstOrDefaultAsync(c => c.Id == conversationId);
            
        if (conversation != null)
        {
            conversation.LastMessageSentAt = systemMessage.SentAt;
            _logger.LogInformation("🔍 SYSTEM_MESSAGE: Found conversation {ConversationId} with {ParticipantCount} participants", 
                conversationId, conversation.Participants.Count);
        }
        else
        {
            _logger.LogWarning("🔍 SYSTEM_MESSAGE: Conversation {ConversationId} not found!", conversationId);
        }

        // Lagre først så vi får message.Id
        await _context.SaveChangesAsync();
        _logger.LogInformation("🔍 SYSTEM_MESSAGE: System message saved with ID: {MessageId}", systemMessage.Id);
        
        var response = new MessageResponseDTO
        {
            Id = systemMessage.Id,
            SenderId = null,
            Sender = null,
            Text = systemMessage.EncryptedText,
            SentAt = systemMessage.SentAt,
            ConversationId = systemMessage.ConversationId,
            IsSystemMessage = true,
            IsSilent = false,
            Reactions = new List<ReactionDTO>()
        };

        // Send SystemMessage over SignalR til alle deltakere
        if (conversation != null)
        {
            try
            {
                // 🔧 FIX: Add null checking and filtering
                var participantIds = conversation.Participants
                    .Where(p => p.UserId > 0) // Ensure valid UserId
                    .Where(p => excludeUserIds == null || !excludeUserIds.Contains(p.UserId))
                    .Select(p => p.UserId.ToString())
                    .Where(id => !string.IsNullOrEmpty(id)) // Extra safety
                    .ToList();

                _logger.LogInformation("🔍 SYSTEM_MESSAGE: Sending system message {MessageId} to {ParticipantCount} participants: [{ParticipantIds}]", 
                    systemMessage.Id, participantIds.Count, string.Join(", ", participantIds));

                if (participantIds.Any())
                {
                    // Send til alle deltakere
                    await _hubContext.Clients.Users(participantIds)
                        .SendAsync("ReceiveMessage", response);
                        
                    _logger.LogInformation("🔍 SYSTEM_MESSAGE: Successfully sent system message {MessageId} via SignalR", 
                        systemMessage.Id);
                }
                else
                {
                    _logger.LogWarning("🔍 SYSTEM_MESSAGE: No valid participants to send SignalR message to for conversation {ConversationId}", 
                        conversationId);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🔍 SYSTEM_MESSAGE_ERROR: Failed to send SignalR message for system message {MessageId} in conversation {ConversationId}", 
                    systemMessage.Id, conversationId);
                // Don't rethrow - system message is already saved
            }
        }
        
        return response;
    }
    
    public async Task CreateMessageNotificationAsync(int recipientUserId, int senderUserId, int conversationId, int messageId)
    {
        // 🚀 SINGLE QUERY: Hent alt vi trenger i én spørring
        var query = from c in _context.Conversations
                    where c.Id == conversationId
                    select new
                    {
                        ConversationInfo = new { c.IsGroup, c.GroupName, c.GroupImageUrl },
                        ExistingNotification = _context.MessageNotifications // Group: any sender, 1-1: specific sender
                            .FirstOrDefault(n => n.UserId == recipientUserId &&
                                                 n.ConversationId == conversationId &&
                                                 !n.IsRead &&
                                                 n.Type == NotificationType.NewMessage &&
                                                 (c.IsGroup || n.FromUserId == senderUserId))
                    };

        var result = await query.FirstOrDefaultAsync();
        
        var conversation = result.ConversationInfo;
        var existingNotification = result.ExistingNotification;

        MessageNotification notificationToReturn;

        if (existingNotification != null)
        {
            // 🔄 Oppdater eksisterende notification
            existingNotification.MessageCount = (existingNotification.MessageCount ?? 1) + 1;
            existingNotification.CreatedAt = DateTime.UtcNow;
            existingNotification.MessageId = messageId;
            existingNotification.FromUserId = senderUserId;
            
            notificationToReturn = existingNotification;
        }
        else
        {
            // ✨ Opprett ny notification
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
            notificationToReturn = notification;
        }

        await _context.SaveChangesAsync();

        // 🎯 SMART: Bruk notification entity til å bygge DTO uten extra query
        var dto = await BuildNotificationDTO(notificationToReturn, conversation.IsGroup, conversation.GroupName, conversation.GroupImageUrl);
        
        // 🚀 Automatically queue sync event
        _notificationSyncService.QueueNotificationSyncEvent(dto, recipientUserId);

    }
    
    
    //  Helper method for å bygge DTO uten extra queries til CreateMessageNotifiaitonAsync
    private async Task<MessageNotificationDTO> BuildNotificationDTO(
        MessageNotification notification, 
        bool isGroup, 
        string? groupName,
        string? groupImageUrl)
    {
        // Hent kun user data vi trenger
        var dataQuery = from u in _context.Users
            where u.Id == notification.FromUserId
            select new 
            { 
                u.FullName, 
                ProfileImageUrl = u.Profile != null ? u.Profile.ProfileImageUrl : null,
                MessageText = notification.MessageId.HasValue 
                    ? _context.Messages
                        .Where(m => m.Id == notification.MessageId.Value)
                        .Select(m => m.EncryptedText)
                        .FirstOrDefault()
                    : null
            };

        var data = await dataQuery.FirstOrDefaultAsync();
        string? messageText = data?.MessageText;

        // 🎯 Bygg preview uten full MapToDTO complexity
        string preview;
        var displayCount = notification.MessageCount ?? 1;
        
        if (isGroup)
        {
            if (displayCount > 1)
            {
                preview = $"There are {displayCount} new messages in {groupName}";
            }
            else
            {
                var msgPreview = messageText?.Length > 40 ? messageText.Substring(0, 40) + "..." : messageText ?? "";
                preview = $"sent to {groupName}: {msgPreview}";
            }
        }
        else
        {
            if (displayCount > 1)
            {
                preview = $"has sent you {displayCount} messages";
            }
            else
            {
                var msgPreview = messageText?.Length > 40 ? messageText.Substring(0, 40) + "..." : messageText ?? "";
                preview = $"said: {msgPreview}";
            }
        }

        return new MessageNotificationDTO
        {
            Id = notification.Id,
            Type = notification.Type,
            CreatedAt = notification.CreatedAt,
            IsRead = notification.IsRead,
            ReadAt = notification.ReadAt,
            MessageId = notification.MessageId,
            ConversationId = notification.ConversationId,
            SenderName = data?.FullName,
            SenderId = notification.FromUserId,
            SenderProfileImageUrl = data?.ProfileImageUrl,
            GroupName = groupName,
            GroupImageUrl = groupImageUrl, // 🆕 Nå med gruppebilde
            MessagePreview = preview,
            MessageCount = notification.MessageCount,
            IsConversationRejected = false, // Default - kan optimeres senere hvis nødvendig
            IsReactionUpdate = false
        };
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

        var dto = MapToDTO(created!);
        
        _notificationSyncService.QueueNotificationSyncEvent(dto, receiverId); 
        
        return dto;
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

        var dto = MapToDTO(created!);
    
        // Automatically queue sync event
        _notificationSyncService.QueueNotificationSyncEvent(dto, senderId);
        
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

        var dto = MapToDTO(created!);
    
        // Automatically queue sync event
        _notificationSyncService.QueueNotificationSyncEvent(dto, receiverUserId);
    
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

        var dto = MapToDTO(created!);
    
        // Automatically queue sync event
        _notificationSyncService.QueueNotificationSyncEvent(dto, receiverId);
    
        return dto;
    }
    
    
    public MessageNotificationDTO MapToDTO(MessageNotification n, HashSet<int>? rejectedConversations = null, bool isUpdate = false)
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
            _logger.LogDebug("🔍 Getting notifications for user {UserId} - Page: {Page}, PageSize: {PageSize}", 
                userId, page, pageSize);

            // Valider input
            if (page < 1 || pageSize <= 0)
            {
                throw new ArgumentException("Invalid pagination values");
            }

            // 1️⃣ Tell totale antall notifications (nå kun fra MessageNotifications tabellen)
            var totalCount = await _context.MessageNotifications
                .Where(n => n.UserId == userId)
                .CountAsync();

            // 2️⃣ Hent alle notifications inkludert GroupEvent notifikasjoner
            var messageNotifications = await _context.MessageNotifications
                .Where(n => n.UserId == userId)
                .Include(n => n.FromUser)
                .ThenInclude(u => u.Profile)
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

            var rejectedMessageConversations = await _context.MessageRequests
                .Where(r =>
                    conversationIds.Contains(r.ConversationId!.Value) &&
                    r.ReceiverId == userId &&
                    r.IsRejected)
                .Select(r => r.ConversationId!.Value)
                .Distinct()
                .ToListAsync();

            var rejectedGroupConversations = await _context.GroupRequests
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
                    dto = await _groupNotificationService.ConvertToMessageNotificationDTOAsync(notification);
                }
                else
                {
                    // Vanlige notifikasjoner
                    dto = MapToDTO(notification, rejectedConversationSet);
                }
                
                allNotificationDTOs.Add(dto);
            }

            _logger.LogDebug("✅ Retrieved {NotificationCount} notifications out of {TotalCount} total", 
                allNotificationDTOs.Count, totalCount);

            return (allNotificationDTOs, totalCount);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Failed to get notifications for user {UserId}", userId);
            throw; // Re-throw for proper error handling
        }
    }
    
    
}