using AFBack.Common.Results;
using AFBack.Features.Auth.Repositories;
using AFBack.Features.Blocking.Services;
using AFBack.Features.Bootstrap.DTOs.Responses;
using AFBack.Features.Bootstrap.Extensions;
using AFBack.Features.Friendship.Services;
using AFBack.Features.MessageNotifications.Service;
using AFBack.Features.Notifications.Services;

namespace AFBack.Features.Bootstrap.Services;

public class BootstrapService(
    IUserRepository userRepository,
    INotificationService notificationService,
    IMessageNotificationService messageNotificationService,
    ILogger<BootstrapService> logger,
    IFriendshipService friendshipService,
    IBlockingService blockingService) : IBootstrapService
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
    public async Task<SecondaryBootstrapResponse> GetSecondaryBootstrapAsync(string userId)
    {
        logger.LogInformation("Starting secondary bootstrap for user {UserId}", userId);

        // Fase 1: Hent alt som kan kjøre parallelt
        var conversationsTask = conversationService.GetRecentAsync(userId, limit: 10);
        var unreadTask = messageNotificationService.GetUnreadConversationIdsAsync(userId);
        var pendingRequestsTask = messageService.GetPendingRequestsAsync(userId);
        var messageNotificationsTask = messageNotificationService.GetRecentAsync(userId, limit: 20);
        var friendInvitationsTask = friendService.GetPendingInvitationsAsync(userId, limit: 10);
        var appNotificationsTask = notificationService.GetRecentAsync(userId, limit: 20);

        await Task.WhenAll(
            conversationsTask,
            relationshipsTask,
            unreadTask,
            pendingRequestsTask,
            messageNotificationsTask,
            friendInvitationsTask,
            appNotificationsTask);

        var conversations = await conversationsTask;

        // Fase 2: Hent meldinger for samtalene vi fikk tilbake
        var conversationIds = conversations.Select(c => c.Id).ToList();
        var conversationMessages = await messageService
            .GetMessagesForConversationsAsync(userId, conversationIds, take: 20);

        var response = new SecondaryBootstrapResponseDTO
        {
            RecentConversations = conversations,
            ConversationMessages = conversationMessages,
            AllUserSummaries = await relationshipsTask,
            UnreadConversationIds = await unreadTask,
            PendingMessageRequests = await pendingRequestsTask,
            RecentMessageNotifications = await messageNotificationsTask,
            PendingFriendInvitations = await friendInvitationsTask,
            RecentNotifications = await appNotificationsTask
        };

        logger.LogInformation(
            "Secondary bootstrap completed — Conversations: {Convos}, Relationships: {Rels}, Unread: {Unread}",
            conversations.Count,
            (await relationshipsTask).Count,
            (await unreadTask).Count);

        return response;
    }
}
