using AFBack.Common.DTOs;
using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Features.Blocking.Services;
using AFBack.Features.Broadcast.Services;
using AFBack.Features.Broadcast.Services.Interfaces;
using AFBack.Features.Friendship.DTOs.Responses;
using AFBack.Features.Friendship.Repository;
using AFBack.Infrastructure.Cache;


namespace AFBack.Features.Friendship.Services;

public class FriendshipService(
    ILogger<FriendshipService> logger,
    IFriendshipRepository friendshipRepository,
    IBlockingService blockingService,
    IUserSummaryCacheService userSummaryCacheService,
    IFriendshipRequestRepository friendshipRequestRepository,
    IFriendshipBroadcastService friendshipBroadcastService) : IFriendshipService
{
    
    /// <inheritdoc/>
    public async Task<Result<List<UserSummaryDto>>> GetMyFriendsAsync(string userId)
    {
        logger.LogInformation("UserId: {UserId} fetching friends list", userId);
    
        var friendIds = await friendshipRepository.GetAllFriendIdsAsync(userId);
    
        if (friendIds.Count == 0)
            return Result<List<UserSummaryDto>>.Success([]);
    
        var friendSummaries = await userSummaryCacheService
            .GetUserSummariesAsync(friendIds);
    
        var response = friendIds
            .Where(id => friendSummaries.ContainsKey(id))
            .Select(id => friendSummaries[id])
            .ToList();
    
        logger.LogInformation("UserId: {UserId} has {Count} friends", userId, response.Count);
    
        return Result<List<UserSummaryDto>>.Success(response);
    }
    
    /// <inheritdoc/>
    public async Task<Result<UserFriendsResponse>> GetUserFriendsAsync(string userId, string targetUserId)
    {
        logger.LogInformation("UserId: {UserId} fetching friends for UserId: {TargetUserId}", 
            userId, targetUserId);
        
        // ====== Valider at target eksisterer ======
        var targetSummary = await userSummaryCacheService.GetUserSummaryAsync(targetUserId);
        if (targetSummary == null)
        {
            logger.LogWarning("Target user {TargetUserId} not found", targetUserId);
            return Result<UserFriendsResponse>.Failure("User not found", ErrorTypeEnum.NotFound);
        }
        
        // ====== Sjekk blokkeringer ======
        var blockResult = await blockingService.ValidateNoBlockingsAsync(userId, targetUserId);
        if (blockResult.IsFailure)
            return Result<UserFriendsResponse>.Failure(blockResult.Error, blockResult.ErrorType);
        
        // ====== Hent friendIds for begge ======
        var targetFriendIds = await friendshipRepository.GetAllFriendIdsAsync(targetUserId);
        targetFriendIds.Remove(userId); // Fjerner oss selv
        
        if (targetFriendIds.Count == 0)
            return Result<UserFriendsResponse>.Success(new UserFriendsResponse());
        
        var myFriendIds = await friendshipRepository.GetAllFriendIdsAsync(userId);
        var myFriendIdSet = myFriendIds.ToHashSet();
        
        // ====== Hent UserSummaries - må hente for alle for å sortere påå fullName======
        var allSummaries = await 
            userSummaryCacheService.GetUserSummariesAsync(targetFriendIds);
        
        // ====== Sorter i mutual og other, alfabetisk på FulleName ======
        var mutualFriends = new List<UserSummaryDto>();
        var otherFriends = new List<UserSummaryDto>();
        
        foreach (var friendId in targetFriendIds)
        {
            if (!allSummaries.TryGetValue(friendId, out var summary))
                continue;
            
            if (myFriendIdSet.Contains(friendId))
                mutualFriends.Add(summary);
            else
                otherFriends.Add(summary);
        }
        
        var response = new UserFriendsResponse
        {
            MutualFriends = mutualFriends.OrderBy(u => u.FullName).ToList(),
            OtherFriends = otherFriends.OrderBy(u => u.FullName).ToList()
        };
        
        logger.LogInformation(
            "UserId: {UserId} fetched friends for {TargetUserId}. Mutual: {MutualCount}, Other: {OtherCount}",
            userId, targetUserId, response.MutualFriends.Count, response.OtherFriends.Count);
        
        return Result<UserFriendsResponse>.Success(response);
    }
    
    /// <inheritdoc/>
    public async Task<Result> RemoveFriendshipAsync(string userId, string friendId)
    {
        logger.LogInformation("UserId: {UserId} removing friendship with UserId: {FriendId}", userId, friendId);
    
        // ====== Valider at vennskapet eksisterer ======
        var friendship = await friendshipRepository.GetFriendshipBetweenUsersAsync(userId, friendId);
        if (friendship == null)
        {
            logger.LogWarning("UserId: {UserId} tried to remove non-existent friendship with UserId: {FriendId}",
                userId, friendId);
            return Result.Failure("Friendship not found", ErrorTypeEnum.NotFound);
        }
    
        // ====== Slett FriendshipRequest (hvis den finnes) ======
        var friendshipRequest = await friendshipRequestRepository.GetFriendshipRequestAsync(userId, friendId);
        if (friendshipRequest != null)
            friendshipRequestRepository.Remove(friendshipRequest);
    
        // ====== Slett Friendship ======
        friendshipRepository.Remove(friendship);
        await friendshipRepository.SaveChangesAsync();
    
        logger.LogInformation("UserId: {UserId} successfully removed friendship with UserId: {FriendId}",
            userId, friendId);
    
        // ====== Post-commit: Stille SignalR og SyncEvent ======
        await friendshipBroadcastService.BroadcastFriendshipRemovedAsync(userId, friendId);
    
        return Result.Success();
    }
    
    /// <inheritdoc/>
    public async Task<Result<PaginatedResponse<UserSummaryDto>>> SearchFriendsAsync(
        string userId, string targetUserId, string query, int page, int pageSize)
    {
        logger.LogInformation(
            "UserId: {UserId} searching friends for {TargetUserId} with query '{Query}' (Page: {Page}, " +
            "PageSize: {PageSize})",
            userId, targetUserId, query, page, pageSize);
    
        // ====== Valider target bruker ======
        if (userId != targetUserId)
        {
            var targetSummary = await userSummaryCacheService.GetUserSummaryAsync(targetUserId);
            if (targetSummary == null)
            {
                logger.LogWarning("Target user {TargetUserId} not found", targetUserId);
                return Result<PaginatedResponse<UserSummaryDto>>.Failure("User not found", 
                    ErrorTypeEnum.NotFound);
            }
        
            var blockResult = await blockingService.ValidateNoBlockingsAsync(userId, targetUserId);
            if (blockResult.IsFailure)
                return Result<PaginatedResponse<UserSummaryDto>>.Failure(blockResult.Error, 
                    blockResult.ErrorType);
        }
    
        // ====== Søk ======
        var friends = await friendshipRepository.SearchFriendsAsync(targetUserId, 
            query, page, pageSize);
        var totalCount = await friendshipRepository.SearchFriendsCountAsync(targetUserId, query);
    
        return Result<PaginatedResponse<UserSummaryDto>>.Success(
            new PaginatedResponse<UserSummaryDto>
            {
                Items = friends,
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize
            });
    }
}
