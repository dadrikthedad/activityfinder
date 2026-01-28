using AFBack.Cache;
using AFBack.DTOs;
using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.MessageNotification.DTOs;
using AFBack.Features.MessageNotification.Extensions;
using AFBack.Features.MessageNotification.Models;
using AFBack.Features.MessageNotification.Models.Enum;
using AFBack.Features.MessageNotification.Repository;

namespace AFBack.Features.MessageNotification.Service;

public class GroupNotificationService(
    ILogger<GroupNotificationService> logger,
    IMessageNotificationRepository notificationRepository) : IGroupNotificationService
{
    
    /// <inheritdoc />
    public async Task<Dictionary<string, MessageNotificationResponse>> CreateGroupNotificationEventAsync(
        List<string> recipientIds, UserSummaryDto triggeredByUser, ConversationResponse conversationResponse,
        GroupEventType type, string summary)
    {
        var notifications = new Dictionary<string, MessageNotificationResponse>();
        
        foreach (var recipientId in recipientIds)
        {
            try
            {
                var notification = await notificationRepository
                    .GetUnreadGroupEventNotificationAsync(recipientId, conversationResponse.Id);

                GroupEvent groupEvent;

                if (notification == null)
                {
                    // Opprett ny notification
                    notification = new Models.MessageNotification
                    {
                        RecipientId = recipientId,
                        SenderId = triggeredByUser.Id,
                        ConversationId = conversationResponse.Id,
                        Type = MessageNotificationType.GroupEvent,
                        Summary = summary,
                        EventCount = 1,
                        CreatedAt = DateTime.UtcNow,
                        LastUpdatedAt = DateTime.UtcNow,
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

                notifications[recipientId] = notification.ToGroupResponse(allEvents, 
                    conversationResponse, triggeredByUser);
                    
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to create group notification for user {UserId}", recipientId);
            }
        }

        return notifications;
    }
    

 
}
