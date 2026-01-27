using AFBack.Common;
using AFBack.Common.Results;
using AFBack.Repository;
using AFBack.Services.Block;

namespace AFBack.Features.Block;

public class BlockService(
    ILogger<BlockService> logger,
    IUserBlockRepository userBlockRepository) : IBlockService
{
    // Sjekk interface for summary
    public async Task<Result> ValidateNoBlockingsAsync(string userId1, string userId2)
    {
        // Sjekk om userId1 har blokkert userId2
        if (await userBlockRepository.IsFirstUserBlockedBySecondary(userId2, userId1))
        {
            logger.LogWarning("User {UserId1} tried to interact with blocked user {UserId2}", 
                userId1, userId2);
            return Result.Failure(
                "You cannot perform this action with a user you have blocked", 
                ErrorTypeEnum.Forbidden);
        }
        
        // Sjekk om userId2 har blokkert userId1
        if (await userBlockRepository.IsFirstUserBlockedBySecondary(userId1, userId2))
        {
            logger.LogWarning("User {UserId1} tried to interact with user {UserId2} who has blocked them", 
                userId1, userId2);
            return Result.Failure(
                "This user has been deleted, is no longer visible, or you lack the required permission",
                ErrorTypeEnum.Forbidden);
        }
        
        return Result.Success();
    }
    
    // Sjekk interface for summary
    public async Task<Result> ValidateNotBlockedByUserAsync(string blockerId, string blockedId)
    {
        if (await userBlockRepository.IsFirstUserBlockedBySecondary(blockedId, blockerId))
        {
            logger.LogWarning("User {BlockerId} tried to interact with blocked user {BlockedId}", 
                blockerId, blockedId);
            return Result.Failure(
                "You cannot perform this action with a user you have blocked",
                ErrorTypeEnum.Forbidden);
        }
        
        return Result.Success();
    }
}
