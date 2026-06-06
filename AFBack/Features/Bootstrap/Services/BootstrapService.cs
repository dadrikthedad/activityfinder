using AFBack.Common.DTOs;
using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Features.Auth.Repositories;
using AFBack.Features.Blocking.Services;
using AFBack.Features.Bootstrap.DTOs.Responses;
using AFBack.Features.Bootstrap.Extensions;
using AFBack.Features.Conversation.Enums;
using AFBack.Features.Conversation.Services;
using AFBack.Features.MessageNotifications.Service;
using AFBack.Features.Messaging.DTOs.Response;
using AFBack.Features.Messaging.Services;

namespace AFBack.Features.Bootstrap.Services;

public class BootstrapService(
    IUserRepository userRepository,
    ILogger<BootstrapService> logger,
    IBlockingService blockingService,
    IServiceScopeFactory scopeFactory) : IBootstrapService
{
    /// <inheritdoc/>
    public async Task<Result<CriticalBootstrapResponse>> GetCriticalBootstrapAsync(string userId)
    {
        logger.LogInformation("Starting critical bootstrap for user {UserId}", userId);

        var user = await userRepository.GetUserWithProfileAndSettingsAsync(userId);
        if (user == null)
        {
            logger.LogError("User {UserId} retrieving bootstrap does not exist", userId);
            return Result<CriticalBootstrapResponse>.Failure("User does not exist", AppErrorCode.NotFound);
        }

        var blockedUsersResult = await blockingService.GetBlockedUsersAsync(userId);
        if (blockedUsersResult.IsFailure)
            return Result<CriticalBootstrapResponse>.Failure(blockedUsersResult.Error, blockedUsersResult.ErrorCode);

        var response = new CriticalBootstrapResponse
        {
            User = user.ToUserResponse(),
            Profile = user.UserProfile?.ToProfileResponse()!,
            Settings = user.UserSettings?.ToSettingsResponse()!,
            BlockedUsers = blockedUsersResult.Value!
        };

        logger.LogInformation("Critical bootstrap completed for user {UserName}", user.FullName);
        return Result<CriticalBootstrapResponse>.Success(response);
    }

    /// <inheritdoc/>
    public async Task<Result<SecondaryBootstrapResponse>> GetSecondaryBootstrapAsync(string userId)
    {
        logger.LogInformation("Starting secondary bootstrap for user {UserId}", userId);

        var paginationRequest = new PaginationRequest { Page = 1, PageSize = 10 };
        var notificationPagination = new PaginationRequest { Page = 1, PageSize = 20 };

        // Hver task får sin egen scope og dermed sin egen DbContext-instans
        var activeConversationsTask = RunInScopeAsync(scope =>
            scope.GetRequiredService<IGetConversationsService>()
                 .GetActiveConversationsAsync(userId, paginationRequest));

        var pendingConversationsTask = RunInScopeAsync(scope =>
            scope.GetRequiredService<IGetConversationsService>()
                 .GetPendingConversationsAsync(userId, paginationRequest));

        var messageNotificationsTask = RunInScopeAsync(scope =>
            scope.GetRequiredService<IMessageNotificationQueryService>()
                 .GetNotificationsAsync(userId, notificationPagination));

        var unreadMessageCountTask = RunInScopeAsync(scope =>
            scope.GetRequiredService<IMessageNotificationQueryService>()
                 .GetUnreadCountAsync(userId));

        var unreadConversationIdsTask = RunInScopeAsync(scope =>
            scope.GetRequiredService<IMessageNotificationQueryService>()
                 .GetUnreadConversationIdsAsync(userId));

        await Task.WhenAll(
            activeConversationsTask,
            pendingConversationsTask,
            messageNotificationsTask,
            unreadMessageCountTask,
            unreadConversationIdsTask);

        var activeResult = activeConversationsTask.Result;
        if (activeResult.IsFailure)
            return Result<SecondaryBootstrapResponse>.Failure(activeResult.Error, activeResult.ErrorCode);

        var pendingResult = pendingConversationsTask.Result;
        if (pendingResult.IsFailure)
            return Result<SecondaryBootstrapResponse>.Failure(pendingResult.Error, pendingResult.ErrorCode);

        var messageNotificationsResult = messageNotificationsTask.Result;
        if (messageNotificationsResult.IsFailure)
            return Result<SecondaryBootstrapResponse>.Failure(messageNotificationsResult.Error,
                messageNotificationsResult.ErrorCode);

        var allMessageConversationIds = activeResult.Value!.Conversations
            .Select(c => c.Id)
            .Concat(pendingResult.Value!.Conversations
                .Where(c => c.Type != ConversationType.GroupChat)
                .Select(c => c.Id))
            .ToList();

        Dictionary<int, List<MessageResponse>> conversationMessages = [];
        if (allMessageConversationIds.Count > 0)
        {
            var messagesResult = await RunInScopeAsync(scope =>
                scope.GetRequiredService<IMessageQueryService>()
                     .GetMessagesForConversationsAsync(userId, allMessageConversationIds, messagesPerConversation: 10));

            if (messagesResult.IsFailure)
                return Result<SecondaryBootstrapResponse>.Failure(messagesResult.Error, messagesResult.ErrorCode);

            conversationMessages = messagesResult.Value!;
        }

        var response = new SecondaryBootstrapResponse
        {
            ActiveConversations = activeResult.Value!.Conversations,
            PendingConversations = pendingResult.Value!.Conversations,
            ConversationMessages = conversationMessages,
            MessageNotifications = messageNotificationsResult.Value!.Items,
            UnreadMessageNotificationCount = unreadMessageCountTask.Result,
            UnreadConversationIds = unreadConversationIdsTask.Result
        };

        logger.LogInformation(
            "Secondary bootstrap completed — Active: {Active}, Pending: {Pending}, Messages: {Msgs}",
            response.ActiveConversations.Count,
            response.PendingConversations.Count,
            conversationMessages.Values.Sum(m => m.Count));

        return Result<SecondaryBootstrapResponse>.Success(response);
    }

    private async Task<T> RunInScopeAsync<T>(Func<IServiceProvider, Task<T>> work)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        return await work(scope.ServiceProvider);
    }
}
