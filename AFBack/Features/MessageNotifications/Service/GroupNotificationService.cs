using AFBack.Common.DTOs;
using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.MessageNotification.Models;
using AFBack.Features.MessageNotification.Models.Enum;
using AFBack.Features.MessageNotifications.DTOs;
using AFBack.Features.MessageNotifications.Extensions;
using AFBack.Features.MessageNotifications.Models;
using AFBack.Features.MessageNotifications.Models.Enum;
using AFBack.Features.MessageNotifications.Repository;

namespace AFBack.Features.MessageNotifications.Service;

public class GroupNotificationService(
    ILogger<GroupNotificationService> logger,
    IMessageNotificationRepository notificationRepository) : IGroupNotificationService
{
    
    /// <inheritdoc />
    public async Task<Dictionary<string, MessageNotificationResponse>> CreateGroupNotificationEventAsync(
        List<string> recipientIds, UserSummaryDto triggeredByUser, ConversationResponse conversationResponse,
        GroupEventType type, string summary, Dictionary<string, bool> memberReadStatus)
    {
        var notifications = new Dictionary<string, MessageNotificationResponse>();
        
        foreach (var recipientId in recipientIds)
        {
            try
            {
                var isRead = memberReadStatus.GetValueOrDefault(recipientId, false);
                
                // Hvis aktiv: hent siste notification (uansett status)
                // Hvis ikke aktiv: hent kun ulest notification
                var notification = isRead
                    ? await notificationRepository
                        .GetLatestGroupEventNotificationAsync(recipientId, conversationResponse.Id)
                    : await notificationRepository
                        .GetUnreadGroupEventNotificationAsync(recipientId, conversationResponse.Id);

                GroupEvent groupEvent;

                if (notification == null)
                {
                    // Opprett ny notification
                    notification = new MessageNotifications.Models.MessageNotification
                    {
                        RecipientId = recipientId,
                        SenderId = triggeredByUser.Id,
                        ConversationId = conversationResponse.Id,
                        Type = MessageNotificationType.GroupEvent,
                        Summary = summary,
                        EventCount = 1,
                        CreatedAt = DateTime.UtcNow,
                        LastUpdatedAt = DateTime.UtcNow,
                        IsRead = isRead
                    };

                    await notificationRepository.CreateMessageNotificationAsync(notification);

                    // Opprett første GroupEvent
                    groupEvent = new GroupEvent
                    {
                        ConversationId = conversationResponse.Id,
                        EventType = type,
                        TriggeredByUserId = triggeredByUser.Id,
                        Summary = summary,
                        CreatedAt = DateTime.UtcNow
                    };
                    
                    await notificationRepository.CreateGroupEventAsync(groupEvent);
                    
                    var messageNotificationGroupEvent = new MessageNotificationGroupEvent
                    {
                        MessageNotificationId = notification.Id,
                        GroupEventId = groupEvent.Id
                    };
                    
                    await notificationRepository
                        .CreateMessageNotificationGroupEventAsync(messageNotificationGroupEvent);
                    
                }
                else
                {
                    // Eksisterende notification
                    groupEvent = new GroupEvent
                    {
                        ConversationId = conversationResponse.Id,
                        EventType = type,
                        TriggeredByUserId = triggeredByUser.Id,
                        Summary = summary,
                        CreatedAt = DateTime.UtcNow
                    };

                    await notificationRepository.CreateGroupEventAsync(groupEvent);
                    
                    var messageNotificationGroupEvent = new MessageNotificationGroupEvent
                    {
                        MessageNotificationId = notification.Id,
                        GroupEventId = groupEvent.Id
                    };
                    
                    await notificationRepository
                        .CreateMessageNotificationGroupEventAsync(messageNotificationGroupEvent);

                    notification.EventCount++;
                    notification.LastUpdatedAt = DateTime.UtcNow;
                
                    // Oppdater summary til aggregert tekst
                    notification.Summary = 
                        $"{notification.EventCount} new activities in \"{conversationResponse.GroupName}\"";
                }

                await notificationRepository.SaveMessageNotificationAsync();

                // Hent alle events for denne notifikasjonen
                var allEvents = await notificationRepository
                    .GetGroupEventsForNotificationAsync(notification.Id);

                notifications[recipientId] = notification.ToGroupResponse(allEvents, triggeredByUser,
                    conversationResponse.GroupName, conversationResponse.GroupImageUrl);
                    
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to create group notification for user {UserId}", recipientId);
            }
        }

        return notifications;
    }
}
