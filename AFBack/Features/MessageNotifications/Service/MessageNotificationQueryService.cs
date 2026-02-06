using AFBack.Cache;
using AFBack.Common;
using AFBack.Common.DTOs;
using AFBack.Common.Results;
using AFBack.DTOs;
using AFBack.Features.MessageNotification.Models.Enum;
using AFBack.Features.MessageNotifications.DTOs;
using AFBack.Features.MessageNotifications.Extensions;
using AFBack.Features.MessageNotifications.Repository;

namespace AFBack.Features.MessageNotifications.Service;

public class MessageNotificationQueryService(
    IMessageNotificationRepository messageNotificationRepository,
    ILogger<MessageNotificationQueryService> logger,
    IUserSummaryCacheService userSummaryCacheService) : IMessageNotificationQueryService 
{   
    /// <inheritdoc />
    public async Task<Result<MessageNotificationResponse>> GetMessageNotificationAsync(string userId, 
        int messageNotificationId)
    {
        logger.LogInformation("User {UserId} is trying to retreive MessageNotification with id {messageNotificationId}",
            userId, messageNotificationId);
        
        // Hent MessageNotificaiton fra databasen
        var messageNotification = await messageNotificationRepository
            .GetMessageNotificationWithConversationAsync(messageNotificationId);
        
        if (messageNotification == null)
        {
            logger.LogWarning("User {UserId} tried to get MessageNotification {MessageNotificationId} " +
                              "that does not exists", userId, messageNotificationId);
            return Result<MessageNotificationResponse>.Failure("Message Notification not found",
                ErrorTypeEnum.NotFound);
        }
        
        // Sjekk om mottaker er brukeren som prøver å hente den
        if (messageNotification.RecipientId != userId)
        {
            logger.LogWarning("User {UserId} tried to get MessageNotification with {MessageNotificationId} " +
                              "ment for another user", userId, messageNotificationId);
            return Result<MessageNotificationResponse>.Failure("Message Notification not found",
                ErrorTypeEnum.NotFound);
        }
        
        // Hent sender fra cache
        var senderSummaryDto = await userSummaryCacheService.GetUserSummaryAsync(
            messageNotification.SenderId);
        
        if (senderSummaryDto == null)
        {
            logger.LogWarning(
                "Could not retrieve sender {SenderId} for MessageNotification {MessageNotificationId}",
                messageNotification.SenderId, messageNotificationId);
            return Result<MessageNotificationResponse>.Failure(
                "Could not retrieve sender information", ErrorTypeEnum.NotFound);
        }
        
        // Bygg response basert på type
        if (messageNotification.Type == MessageNotificationType.GroupEvent)
        {
            var groupEvents = await messageNotificationRepository
                .GetGroupEventsForNotificationAsync(messageNotificationId);
        
            return Result<MessageNotificationResponse>.Success(
                messageNotification.ToGroupResponse(groupEvents, senderSummaryDto, 
                    messageNotification.Conversation!.GroupName, messageNotification.Conversation.GroupImageUrl));
        }
        
        return Result<MessageNotificationResponse>.Success(
            messageNotification.ToResponse(senderSummaryDto, messageNotification.Conversation!.GroupName,
                messageNotification.Conversation.GroupImageUrl));
    }
    
    /// <inheritdoc />
    public async Task<Result<PaginatedResponse<MessageNotificationResponse>>> GetNotificationsAsync(
        string userId, PaginationRequest request)
    {
        logger.LogInformation("User {UserId} is retrieving notifications - Page: {Page}, PageSize: {PageSize}",
            userId, request.Page, request.PageSize);
        
        // Hent paginerte notifications med totalt antall
        var (notifications, totalCount) = await messageNotificationRepository
            .GetPaginatedNotificationsAsync(userId, request.Page, request.PageSize);
        
        // Null notifikasjoner, returner en tom PaginatedResponse
        if (notifications.Count == 0)
        {
            logger.LogInformation("No notifications found for user {UserId}", userId);
            return Result<PaginatedResponse<MessageNotificationResponse>>.Success(
                new PaginatedResponse<MessageNotificationResponse>
                {
                    Items = [],
                    TotalCount = totalCount,
                    Page = request.Page,
                    PageSize = request.PageSize
                });
        }

        // Samle alle unike SenderIds for batch-henting fra cache
        var senderIds = notifications
            .Select(n => n.SenderId)
            .Distinct()
            .ToList();
        
        var userSummaries = await userSummaryCacheService.GetUserSummariesAsync(senderIds);

        // Hent GroupEvents for GroupEvent-notifications (batch)
        var groupEventNotificationIds = notifications
            .Where(n => n.Type == MessageNotificationType.GroupEvent)
            .Select(n => n.Id)
            .ToList();

        var groupEventsDict = await GetGroupEventsDictionaryAsync(groupEventNotificationIds);

        // 4. Map til responses
        var responses = notifications
            .Select(n => MapToResponse(n, userSummaries, groupEventsDict))
            .ToList();

        logger.LogInformation("Retrieved {Count} notifications for user {UserId} (Total: {Total})",
            responses.Count, userId, totalCount);

        return Result<PaginatedResponse<MessageNotificationResponse>>.Success(
            new PaginatedResponse<MessageNotificationResponse>
            {
                Items = responses,
                TotalCount = totalCount,
                Page = request.Page,
                PageSize = request.PageSize
            });
    }
    
    /// <inheritdoc />
    public async Task<Result<List<MessageNotificationResponse>>> GetNotificationsByConversationAsync(
        string userId, int conversationId)
    {
        logger.LogInformation("User {UserId} is retrieving notifications for conversation {ConversationId}",
            userId, conversationId);

        // Hent alle notifications for samtalen
        var notifications = await messageNotificationRepository
            .GetMessageNotificationsForConversationAsync(userId, conversationId);

        if (notifications.Count == 0)
        {
            logger.LogDebug("No notifications found for user {UserId} in conversation {ConversationId}",
                userId, conversationId);
            return Result<List<MessageNotificationResponse>>.Success([]);
        }

        // Samle alle unike SenderIds for batch-henting fra cache
        var senderIds = notifications
            .Select(n => n.SenderId)
            .Distinct()
            .ToList();

        var userSummaries = await userSummaryCacheService.GetUserSummariesAsync(senderIds);

        // Hent GroupEvents for GroupEvent-notifications
        var groupEventNotificationIds = notifications
            .Where(n => n.Type == MessageNotificationType.GroupEvent)
            .Select(n => n.Id)
            .ToList();

        var groupEventsDict = await GetGroupEventsDictionaryAsync(groupEventNotificationIds);

        // Map til responses
        var responses = notifications
            .Select(n => MapToResponse(n, userSummaries, groupEventsDict))
            .ToList();

        logger.LogInformation("Retrieved {Count} notifications for user {UserId} in conversation {ConversationId}",
            responses.Count, userId, conversationId);

        return Result<List<MessageNotificationResponse>>.Success(responses);
    }
    
    /// <inheritdoc />
    public async Task<int> GetUnreadCountAsync(string userId)
    {
        logger.LogDebug("User {UserId} is retrieving unread notification count", userId);
    
        return await messageNotificationRepository.GetUnreadCountAsync(userId);
    }

    /// <summary>
    /// Henter og grupperer GroupEvents for flere notifications med maks antall per notification
    /// </summary>
    /// <param name="notificationIds"></param>
    /// <returns>Dictionary med Key = messageNotificaitonId og Value = Liste med GroupEvents</returns>
    private async Task<Dictionary<int, List<MessageNotification.Models.GroupEvent>>> GetGroupEventsDictionaryAsync(
        List<int> notificationIds)
    {
        if (notificationIds.Count == 0)
            return new Dictionary<int, List<MessageNotification.Models.GroupEvent>>();
        
        // Henter mange tuple med MessageNotfiicationId og GroupEvent, Eks: MessageNotificationId: 5, GroupEvent: "...."
        var allGroupEvents = await messageNotificationRepository
            .GetGroupEventsForNotificationsAsync(notificationIds);
        
        // Vi samler alle MessageNotificaitons med sine tilhørende GroupEvents, og vi tar maks satt i AppCosntants
        // med Take
        return allGroupEvents
            .GroupBy(x => x.MessageNotificationId)
            .ToDictionary(
                g => g.Key,
                g => g.Take(ApplicationConstants.Groups.MaxEventsPerNotification)
                      .Select(x => x.GroupEvent)
                      .ToList()
            );
    }
    
    /// <summary>
    /// Mapper notifikasjoner til MessageNotificationResponse utifra om det er for vanlig samtaler eller grupper.
    /// UserSummary til sender blir også mappet her
    /// </summary>
    /// <param name="notification"></param>
    /// <param name="userSummaries"></param>
    /// <param name="groupEventsDict"></param>
    /// <returns></returns>
    private MessageNotificationResponse MapToResponse(
        MessageNotifications.Models.MessageNotification notification,
        Dictionary<string, UserSummaryDto> userSummaries,
        Dictionary<int, List<MessageNotification.Models.GroupEvent>> groupEventsDict)
    {
        // Henter ut senderen til denne spesifikke notifikasjonen
        var senderDto = userSummaries.GetValueOrDefault(notification.SenderId) 
                        ?? new UserSummaryDto { Id = notification.SenderId, FullName = "Unknown" };
        
        // Er det en gruppe må vi bruke ToGroupResponse
        if (notification.Type == MessageNotificationType.GroupEvent)
        {
            var events = groupEventsDict.GetValueOrDefault(notification.Id) ?? [];
            return notification.ToGroupResponse(events, senderDto, 
                notification.Conversation?.GroupName, notification.Conversation?.GroupImageUrl);
        }
        
        // Vanlige 1-1, invitasjoner og meldinger til standard response
        return notification.ToResponse(senderDto, 
            notification.Conversation?.GroupName, notification.Conversation?.GroupImageUrl);
    }
}
