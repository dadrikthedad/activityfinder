using AFBack.DTOs;
using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.MessageNotification.DTOs;
using AFBack.Features.MessageNotification.Extensions;
using AFBack.Features.MessageNotification.Models;
using AFBack.Features.MessageNotification.Models.Enum;
using AFBack.Features.MessageNotification.Repository;
using AFBack.Features.Messaging.DTOs.Response;
using AFBack.Features.SyncEvents.Enums;
using AFBack.Features.SyncEvents.Services;
using AFBack.Models;
using AFBack.Models.Enums;

namespace AFBack.Features.MessageNotification.Service;

public class MessageNotificationService(
    ILogger<MessageNotificationService> logger,
    GroupNotificationService groupNotificationService,
    ISyncService syncService,
    IMessageNotificationRepository messageNotificationRepository) : IMessageNotificationService
{
    private readonly int _previewMessageLength = 40;
    
    // ======================== Ny meldings notifikasjon ========================
    
    // Sjekk interface for summary
    public async Task<MessageNotificationResponse> CreateNewMessageNotificationAsync(string recipientId, 
        string senderId, ConversationResponse conversationResponse, MessageResponse messageResponse)
    {
        // Henter en eksisterende MessageNotification hvis det eksisterer en
        var existingMessageNotification = await messageNotificationRepository.GetMessageNotificationAsync(recipientId,
            senderId, conversationResponse);

        Models.MessageNotification messageNotification;
        
        // Hvis den eksisterere så oppdaterer vi feltene for å bygge en ny, oppdatert melding
        if (existingMessageNotification != null)
        {
            existingMessageNotification.MessageCount++; // Øker antall meldinger i en notifikasjon
            existingMessageNotification.LastUpdatedAt = DateTime.UtcNow; // Opptadeterer tiden
            existingMessageNotification.MessageId = messageResponse.Id; // Endrer nå til nyeste melding for å vise riktig Id
            existingMessageNotification.SenderId = senderId; // Nyeste avsender for å vise riktig navn i Gruppe
            
            // Oppdater summary for flere meldinger
            existingMessageNotification.Summary = BuildMultipleMessagesSummary(
                existingMessageNotification.MessageCount,
                conversationResponse.Type,
                conversationResponse.GroupName);
            
            await messageNotificationRepository.SaveMessageNotificationAsync();
            messageNotification = existingMessageNotification;
        }
        else
        {
            // Bygg summary for første melding
            var summary = BuildFirstMessageSummary(
                messageResponse.EncryptedText,
                messageResponse.EncryptedAttachments?.Count ?? 0,
                conversationResponse.Type,
                conversationResponse.GroupName);
            
            // Oppretter en ny notificaiton
            var notification = new Models.MessageNotification
            {
                RecipientId = recipientId,
                SenderId = senderId,
                MessageId = messageResponse.Id,
                ConversationId = conversationResponse.Id,
                Type = MessageNotificationType.NewMessage,
                CreatedAt = DateTime.UtcNow,
                Summary = summary,
                LastUpdatedAt = DateTime.UtcNow
            };
            
            // Lagrer den i databasen
            await messageNotificationRepository.CreateMessageNotificationAsync(notification);
            messageNotification = notification;
        }
        
        // Hent sender for response
        var sender = conversationResponse.Participants
            .FirstOrDefault(p => p.User.Id == senderId)?.User;
    
        return messageNotification.ToResponse(sender!, conversationResponse.GroupName, 
            conversationResponse.GroupImageUrl);
    }
    
    /// <summary>
    /// Bygger summary for første uleste melding i en notification. Egen summary hvis det er med tekst, og hvis det er
    /// kun attachments så blir det en egen summary for det
    /// </summary>
    /// <param name="messageText">Teksten i meldingen</param>
    /// <param name="numberOfAttachments">Antall attachments for å bygge summary hvis det er ingen tekst</param>
    /// <param name="conversationType">Forskjellige fra gruppe og vanlig samtale</param>
    /// <param name="groupName">Navnet på gruppen</param>
    /// <returns>En summary string</returns>
    private string BuildFirstMessageSummary(string? messageText, int numberOfAttachments, 
        ConversationType conversationType, string? groupName)
    {
        if (!string.IsNullOrEmpty(messageText))
        {
            var msgPreview = messageText.Length > _previewMessageLength 
                ? messageText[.._previewMessageLength] + "..." 
                : messageText;

            return conversationType != ConversationType.GroupChat
                ? $"said: {msgPreview}"
                : $"sent to {groupName}: {msgPreview}";
        }

        if (numberOfAttachments > 0)
        {
            var attachmentText = numberOfAttachments == 1
                ? "1 attachment"
                : $"{numberOfAttachments} attachments";

            return conversationType != ConversationType.GroupChat
                ? $"sent {attachmentText}"
                : $"sent {attachmentText} to {groupName}";
        }
    
        return "sent a message";
    }

    /// <summary>
    /// Bygger summary for flere uleste meldinger i en notification. Forskjellige mellom gruppesamtaler og vanlig
    /// </summary>
    /// <param name="messageCount">Antall meldinger sendt</param>
    /// <param name="conversationType">Type samtale (Gruppe eller 1-1)</param>
    /// <param name="groupName">Navnet på gruppen</param>
    /// <returns>En summary tekst</returns>
    private string BuildMultipleMessagesSummary(int messageCount, ConversationType conversationType, string? groupName)
         => conversationType != ConversationType.GroupChat
            ? $"has sent you {messageCount} messages"
            : $"There are {messageCount} new messages in {groupName}";
    
    
    // ======================== Direct Chat Notifikasjoner ========================
    
    // Sjekk interface for summary
    public async Task<MessageNotificationResponse> CreatePendingConversationNotificationAsync(string recipientId, 
        string senderId, ConversationResponse conversationResponse)
    {
        // Henter Sender for SyncEvent
        var senderParticipant = conversationResponse.Participants
            .FirstOrDefault(p => p.User.Id == senderId);
        
        if (senderParticipant == null)
        {
            logger.LogError("Sender {SenderId} not found in conversation {ConversationId}",
                senderId, conversationResponse.Id);
            throw new InvalidOperationException(
                $"Sender {senderId} not found in conversation {conversationResponse.Id}");
        }
        
        // Preview for Notification
        var summary = conversationResponse.Type != ConversationType.GroupChat
            ? $"{senderParticipant.User.FullName} wants to message you"
            : $"{senderParticipant.User.FullName} invited you to join {conversationResponse.GroupName}";
        
        // Oppretter en ny notification
        var notification = new Models.MessageNotification
        {
            RecipientId = recipientId,
            SenderId = senderId,
            ConversationId = conversationResponse.Id,
            Type = MessageNotificationType.PendingMessageRequestReceived,
            CreatedAt = DateTime.UtcNow,
            Summary = summary,
            LastUpdatedAt = DateTime.UtcNow,
        };
        
        // Lagrer i databasen
        await messageNotificationRepository.CreateMessageNotificationAsync(notification);
        
        // Oppretter en MessageNotificaitonResponse
        return notification.ToResponse(
            senderParticipant.User);
    }
    
    
    
    // Sjekk interface for summary
    public async Task<MessageNotificationResponse> CreateConversationAcceptedNotificationAsync(string recipientId, 
        string senderId, ConversationResponse conversationResponse, string notificationSummary,
        UserSummaryDto senderUserSummary)
    {
        // Oppretter en ny notification
        var notification = new Models.MessageNotification
        {
            RecipientId = recipientId,
            SenderId = senderId,
            ConversationId = conversationResponse.Id,
            Type = MessageNotificationType.PendingConversationRequestApproved,
            CreatedAt = DateTime.UtcNow,
            Summary = notificationSummary,
            LastUpdatedAt = DateTime.UtcNow,
        };
        
        // Lagrer i databasen
        await messageNotificationRepository.CreateMessageNotificationAsync(notification);
        
        return notification.ToResponse(
            senderUserSummary);
    }
    
    
    /// <inheritdoc />
    public async Task CreateGroupMemberJoinedNotificationAsync(string recipientId, string joinedUserId,
        ConversationResponse conversationResponse)
    {
        // Oppretter en ny notification
        var notification = new Models.MessageNotification
        {
            RecipientId = recipientId,
            SenderId = joinedUserId,
            ConversationId = conversationResponse.Id,
            Type = MessageNotificationType.GroupRequestApproved,
            CreatedAt = DateTime.UtcNow,
            LastUpdatedAt = DateTime.UtcNow,
        };
        
        // Lagrer i databasen
        await messageNotificationRepository.CreateMessageNotificationAsync(notification);
        
        // Henter brukeren som ble med for SyncEvent
        var joinedParticipant = conversationResponse.Participants
            .FirstOrDefault(p => p.User.Id == joinedUserId);
        
        if (joinedParticipant == null)
        {
            logger.LogError("Joined user {JoinedUserId} not found in conversation {ConversationId}",
                joinedUserId, conversationResponse.Id);
            return;
        }
        
        // Preview for GroupMemberJoinedNotification
        var preview = $"{joinedParticipant.User.FullName} has joined \"{conversationResponse.GroupName}\"";

        var messageNotificationResponse = notification.ToResponse(
            joinedParticipant.User, 
            preview,
            conversationResponse.GroupName,
            conversationResponse.GroupImageUrl);
        
        await syncService.CreateSyncEventsAsync(
            new List<string> {recipientId}, 
            SyncEventType.MessageNotificationCreated,
            messageNotificationResponse);
    }
    
    
    

    public async Task CreateGroupNotificationEventAsync(string recipientId, 
        string senderId, ConversationResponse conversationResponse, GroupEventType type, string summary,
        List<int> receivingUsers)
    {
        // Oppretter gruppeeventen
        var groupEvent = new GroupEvent
        {
            ConversationId = conversationResponse.Id,
            EventType = type,
            TriggeredByUserId = recipientId,
            Summary = summary,
            CreatedAt = DateTime.UtcNow
        };
        
        // Lagrer gruppeeventen
        await messageNotificationRepository.CreateGroupEventAsync(groupEvent);
        
        // Finner eller oppretter en MessageNotification med gruppeeventen
        var notification = await messageNotificationRepository
            .GetUnreadGroupEventNotificationAsync(recipientId, conversationResponse.Id);

        if (notification == null)
        {
            notification = new Models.MessageNotification
            {
                RecipientId = recipientId,
                SenderId = senderId,
                ConversationId = conversationResponse.Id,
                Type = MessageNotificationType.GroupEvent,
                CreatedAt = DateTime.UtcNow,
                LastUpdatedAt = DateTime.UtcNow,
                EventCount = 1
            };
            
            // Lagrer i databasen
            await messageNotificationRepository.CreateMessageNotificationAsync(notification);

            var messageNotificationGroupEvent = new MessageNotificationGroupEvent
            {
                MessageNotificationId = notification.Id,
                GroupEventId = groupEvent.Id
            };
            
            await messageNotificationRepository.CreateGroupMessageNotificationGroupEventAsync(
                messageNotificationGroupEvent);
        }
        else
        {
            var messageNotificationGroupEvent = new MessageNotificationGroupEvent
            {
                MessageNotificationId = notification.Id,
                GroupEventId = groupEvent.Id
            };
            
            await messageNotificationRepository.CreateGroupMessageNotificationGroupEventAsync(
                messageNotificationGroupEvent);

            notification.EventCount++;

            await messageNotificationRepository.SaveMessageNotificationAsync();
        }
        
        
        
        return // TODO: Som en Response
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
