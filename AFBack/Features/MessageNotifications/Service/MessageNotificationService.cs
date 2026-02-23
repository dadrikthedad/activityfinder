using AFBack.Common.DTOs;
using AFBack.DTOs;
using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.MessageNotification.Models.Enum;
using AFBack.Features.MessageNotifications.DTOs;
using AFBack.Features.MessageNotifications.Extensions;
using AFBack.Features.MessageNotifications.Repository;
using AFBack.Features.Messaging.DTOs.Response;
using AFBack.Models;
using AFBack.Models.Enums;

namespace AFBack.Features.MessageNotifications.Service;

public class MessageNotificationService(
    ILogger<MessageNotificationService> logger,
    IMessageNotificationRepository messageNotificationRepository) : IMessageNotificationService
{
    private readonly int _previewMessageLength = 40;
    
    // ======================== Ny meldings notifikasjon ========================
    
    /// <inheritdoc />
    public async Task<MessageNotificationResponse> CreateNewMessageNotificationAsync(string recipientId, 
        string senderId, ConversationResponse conversationResponse, MessageResponse messageResponse)
    {
        // Henter en eksisterende MessageNotification hvis det eksisterer en
        var existingMessageNotification = await messageNotificationRepository.GetMessageNotificationWithSenderIdAsync(recipientId,
            senderId, conversationResponse);

        MessageNotifications.Models.MessageNotification messageNotification;
        
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
                messageResponse.EncryptedAttachments.Count,
                conversationResponse.Type,
                conversationResponse.GroupName);
            
            // Oppretter en ny notificaiton
            var notification = new MessageNotifications.Models.MessageNotification
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
    
    /// <inheritdoc />
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
        var notification = new MessageNotifications.Models.MessageNotification
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
    
    
    
    /// <inheritdoc />
    public async Task<MessageNotificationResponse> CreateConversationAcceptedNotificationAsync(string recipientId, 
        string senderId, ConversationResponse conversationResponse, string notificationSummary,
        UserSummaryDto senderUserSummary, bool isRead = false)
    {
        // Oppretter en ny notification
        var notification = new MessageNotifications.Models.MessageNotification
        {
            RecipientId = recipientId,
            SenderId = senderId,
            ConversationId = conversationResponse.Id,
            Type = MessageNotificationType.PendingConversationRequestApproved,
            CreatedAt = DateTime.UtcNow,
            Summary = notificationSummary,
            LastUpdatedAt = DateTime.UtcNow,
            IsRead = isRead
        };
        
        // Lagrer i databasen
        await messageNotificationRepository.CreateMessageNotificationAsync(notification);
        
        return notification.ToResponse(
            senderUserSummary);
    }
    
    
    // ======================== Direct Chat Notifikasjoner ========================
    
    
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
        var notification = new MessageNotifications.Models.MessageNotification
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
}
