using AFBack.Common.DTOs;
using AFBack.Features.Broadcast.Services.Interfaces;
using AFBack.Features.Conversation.Repository;
using AFBack.Features.Friendship.Repository;
using AFBack.Features.SignalR.Constants;
using AFBack.Features.SignalR.Services;
using AFBack.Features.SyncEvents.Enums;
using AFBack.Features.SyncEvents.Services;
using AFBack.Infrastructure.Cache;

namespace AFBack.Features.Broadcast.Services;

public class ProfileBroadcastService(
    ILogger<ProfileBroadcastService> logger,
    IUserSummaryCacheService userSummaryCacheService,
    IFriendshipRepository friendshipRepository,
    IConversationRepository conversationRepository,
    ISignalRNotificationService signalRNotificationService,
    ISyncService syncService) : IProfileBroadcastService
{
    /// <inheritdoc />
    public async Task BroadcastProfileUpdatedAsync(string userId, string fullName, string? profileImageUrl)
    {
        // ====== Refresh UserSummaryCache ======
        await userSummaryCacheService.RefreshUserSummaryAsync(userId);

        // ====== Finn alle berørte brukere ======
        var friendIds = await friendshipRepository.GetAllFriendIdsAsync(userId);
        var conversationPartnerIds = await conversationRepository.GetAllConversationPartnerIdsAsync(userId);

        var affectedUserIds = friendIds
            .Union(conversationPartnerIds)
            .Where(id => id != userId)
            .Distinct()
            .ToList();

        // ====== Payload med kun nødvendige felter ======
        var userSummaryDto = new UserSummaryDto
        {
            Id = userId,
            FullName = fullName,
            ProfileImageUrl = profileImageUrl
        };

        // ====== Broadcaster parallelt (best-effort etter DB commit) ======
        // SyncEvent til brukerens egne andre enheter (alltid)
        await syncService.CreateSyncEventsAsync([userId],
            SyncEventType.MyProfileUpdated, userSummaryDto);

        // Broadcaster til berørte brukere (venner + samtalepartnere)
        if (affectedUserIds.Count == 0)
            return;

        await Task.WhenAll(
            // SignalR og SyncEvent
            signalRNotificationService.SendToUsersAsync(affectedUserIds,
                HubConstants.ClientEvents.UserProfileUpdated, userSummaryDto,
                $"profile update for user {userId}"),

            syncService.CreateSyncEventsAsync(affectedUserIds, SyncEventType.UserProfileUpdated,
                userSummaryDto)
        );

        logger.LogInformation("Profile update broadcasted for UserId: {UserId}. Notified {Count} users",
            userId, affectedUserIds.Count);
    }
}
