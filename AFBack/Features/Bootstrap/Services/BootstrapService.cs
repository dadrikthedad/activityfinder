using AFBack.Common.DTOs;
using AFBack.Common.Results;
using AFBack.Features.Auth.Repositories;
using AFBack.Features.Blocking.Services;
using AFBack.Features.Bootstrap.DTOs.Responses;
using AFBack.Features.Bootstrap.Extensions;
using AFBack.Features.Conversation.Enums;
using AFBack.Features.Conversation.Services;
using AFBack.Features.Friendship.Services;
using AFBack.Features.MessageNotifications.Service;
using AFBack.Features.Messaging.DTOs.Response;
using AFBack.Features.Messaging.Services;
using AFBack.Features.Notifications.Services;

namespace AFBack.Features.Bootstrap.Services;

public class BootstrapService(
    IUserRepository userRepository,
    INotificationService notificationService,
    IMessageNotificationQueryService messageNotificationQueryService,
    ILogger<BootstrapService> logger,
    IFriendshipService friendshipService,
    IBlockingService blockingService,
    IFriendshipRequestService friendshipRequestService,
    GetConversationsService getConversationsService,
    MessageQueryService messageQueryService) : IBootstrapService
{
    
    /// <inheritdoc/>
    public async Task<Result<CriticalBootstrapResponse>> GetCriticalBootstrapAsync(string userId)
    {
        logger.LogInformation("Starting critical bootstrap for user {UserId}", userId);
        
        var user = await userRepository.GetUserWithProfileAndSettingsAsync(userId);
        if (user == null)
        {
            logger.LogError("User {UserId} retrieving bootstrap does not exist", userId);
            return Result<CriticalBootstrapResponse>.Failure("User does not exist");
        }
        
        // Kjører henting av venner og blokkerte bruker parallelt
        var friendsTask = friendshipService.GetMyFriendsAsync(userId);
        var blockedTask = blockingService.GetBlockedUsersAsync(userId);
        await Task.WhenAll(friendsTask, blockedTask);

        var getFriendsResult = await friendsTask;
        if (getFriendsResult.IsFailure)
            return Result<CriticalBootstrapResponse>.Failure(getFriendsResult.Error, getFriendsResult.ErrorType);

        var blockedUsersResult = await blockedTask;
        if (blockedUsersResult.IsFailure)
            return Result<CriticalBootstrapResponse>.Failure(blockedUsersResult.Error, blockedUsersResult.ErrorType);
        
        var response = new CriticalBootstrapResponse
        {
            User = user.ToUserResponse(),
            Profile = user.UserProfile?.ToProfileResponse()!,
            Settings = user.UserSettings?.ToSettingsResponse()!,
            Friends = getFriendsResult.Value!,
            BlockedUsers = blockedUsersResult.Value!
        };

        logger.LogInformation("Critical bootstrap completed for user {UserName}", user.FullName);
        return Result<CriticalBootstrapResponse>.Success(response);
    }

    /// <summary>
    /// Sekundær bootstrap — hentes etter kritisk data er lastet.
    /// Inneholder samtaler, meldinger, relasjoner, varsler, etc.
    /// </summary>
    public async Task<Result<SecondaryBootstrapResponse>> GetSecondaryBootstrapAsync(string userId)
    {
        logger.LogInformation("Starting secondary bootstrap for user {UserId}", userId);

        var paginationRequest = new PaginationRequest { Page = 1, PageSize = 10 };
        var notificationPagination = new PaginationRequest { Page = 1, PageSize = 20 };

        // Fase 1: Alt som kan kjøre parallelt
        var activeConversationsTask = getConversationsService.GetActiveConversationsAsync(userId, paginationRequest);
        var pendingConversationsTask = getConversationsService.GetPendingConversationsAsync(userId, paginationRequest);
        var messageNotificationsTask = messageNotificationQueryService.GetNotificationsAsync(userId, 
            notificationPagination);
        var notificationsTask = notificationService.GetNotificationsAsync(userId, notificationPagination);
        var friendRequestsTask = friendshipRequestService.GetReceivedPendingFriendshipRequestsAsync(userId,
            1, 10);
        var unreadMessageCountTask = messageNotificationQueryService.GetUnreadCountAsync(userId);
        var unreadNotificationCountTask = notificationService.GetUnreadCountAsync(userId);
        var unreadConversationIdsTask = messageNotificationQueryService.GetUnreadConversationIdsAsync(
            userId);

        await Task.WhenAll(
            activeConversationsTask,
            pendingConversationsTask,
            messageNotificationsTask,
            notificationsTask,
            friendRequestsTask,
            unreadMessageCountTask,
            unreadNotificationCountTask,
            unreadConversationIdsTask);

        var activeResult = await activeConversationsTask;
        if (activeResult.IsFailure)
            return Result<SecondaryBootstrapResponse>.Failure(activeResult.Error, activeResult.ErrorType);

        var pendingResult = await pendingConversationsTask;
        if (pendingResult.IsFailure)
            return Result<SecondaryBootstrapResponse>.Failure(pendingResult.Error, pendingResult.ErrorType);

        var messageNotificationsResult = await messageNotificationsTask;
        if (messageNotificationsResult.IsFailure)
            return Result<SecondaryBootstrapResponse>.Failure(messageNotificationsResult.Error,
                messageNotificationsResult.ErrorType);

        var notificationsResult = await notificationsTask;
        if (notificationsResult.IsFailure)
            return Result<SecondaryBootstrapResponse>.Failure(notificationsResult.Error, notificationsResult.ErrorType);

        var friendRequestsResult = await friendRequestsTask;
        if (friendRequestsResult.IsFailure)
            return Result<SecondaryBootstrapResponse>.Failure(friendRequestsResult.Error, 
                friendRequestsResult.ErrorType);

        var unreadConversationIds = await unreadConversationIdsTask;
        
        // Fase 2: Hent meldinger for aktive samtaler + pending 1v1-samtaler
        var conversationIds = activeResult.Value!.Conversations
            .Select(c => c.Id)
            .ToList();

        var pendingDirectIds = pendingResult.Value!.Conversations
            .Where(c => c.Type != ConversationType.GroupChat)
            .Select(c => c.Id)
            .ToList();

        var allMessageConversationIds = conversationIds
            .Concat(pendingDirectIds)
            .ToList();

        Dictionary<int, List<MessageResponse>> conversationMessages = [];
        if (allMessageConversationIds.Count > 0)
        {
            var messagesResult = await messageQueryService.GetMessagesForConversationsAsync(
                userId, allMessageConversationIds, messagesPerConversation: 10);

            if (messagesResult.IsFailure)
                return Result<SecondaryBootstrapResponse>.Failure(messagesResult.Error, messagesResult.ErrorType);

            conversationMessages = messagesResult.Value!;
        }

        var response = new SecondaryBootstrapResponse
        {
            ActiveConversations = activeResult.Value!.Conversations,
            PendingConversations = pendingResult.Value!.Conversations,
            ConversationMessages = conversationMessages,
            MessageNotifications = messageNotificationsResult.Value!.Items,
            Notifications = notificationsResult.Value!.Items,
            PendingFriendshipRequests = friendRequestsResult.Value!.Items,
            UnreadMessageNotificationCount = await unreadMessageCountTask,
            UnreadNotificationCount = await unreadNotificationCountTask,
            UnreadConversationIds = unreadConversationIds
        };

        logger.LogInformation(
            "Secondary bootstrap completed — Active: {Active}, Pending: {Pending}, Messages: {Msgs}, " +
            "FriendRequests: {FR}", response.ActiveConversations.Count, response.PendingConversations.Count,
            conversationMessages.Values.Sum(m => m.Count),
            response.PendingFriendshipRequests.Count);

        return Result<SecondaryBootstrapResponse>.Success(response);
    }
}
