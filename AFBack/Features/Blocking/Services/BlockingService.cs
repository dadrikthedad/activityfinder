using AFBack.Cache;
using AFBack.Common;
using AFBack.Common.Results;
using AFBack.Features.Auth.Models;
using AFBack.Features.Blocking.Models;
using AFBack.Features.Conversation.Repository;
using AFBack.Features.SyncEvents.Enums;
using AFBack.Features.SyncEvents.Services;
using AFBack.Interface.Repository;
using AFBack.Models.Enums;
using Microsoft.AspNetCore.Identity;

namespace AFBack.Features.Blocking.Services;

public class BlockingService(
    ILogger<BlockingService> logger,
    IUserBlockRepository userBlockRepository,
    UserManager<AppUser> userManager,
    IConversationRepository conversationRepository,
    ISendMessageCache sendMessageCache,
    ISyncService syncService) : IBlockingService
{
    /// <inheritdoc />
    public async Task<Result> BlockUserAsync(string userId, string targetUserId)
    {
        // ============ Validering ============
        // Sjekker at brukeren som skal blokkere eksisterer
        var user = await userManager.FindByIdAsync(userId);
        if (user == null)
        {
            logger.LogWarning("Block failed: requesting user {UserId} not found", userId);
            return Result.Failure("User not found", ErrorTypeEnum.NotFound);
        }
        
        if (userId == targetUserId)
        {
            logger.LogWarning("Block failed: User {UserId} cant block itself", userId);
            return Result.Failure("You cannot block yourself", ErrorTypeEnum.BadRequest);
        }
        
        // Sjekker at brukeren som blir blokkert eksisterer
        var targetUser = await userManager.FindByIdAsync(targetUserId);
        if (targetUser == null)
        {
            logger.LogWarning("Block failed: target user {TargetUserId} not found, requested by {UserId}", 
                targetUserId, userId);
            return Result.Failure("User not found", ErrorTypeEnum.NotFound);
        }
        
        // Har vi allerede blokkert brukeren
        if (await userBlockRepository.IsFirstUserBlockedBySecondary(userId, targetUserId))
        {
            logger.LogWarning("User {UserId} tried to block already blocked user {TargetUserId}", 
                userId, targetUserId);
            return Result.Failure("You have already blocked this user", ErrorTypeEnum.Conflict);
        }
        
        // ============ Fjern fra CanSend ============
        
        // Vi sjekker om det er en samtale blandt brukerene
        var conversation = await conversationRepository.GetConversationBetweenUsersAsync(userId, targetUserId);
        if (conversation != null)
        {
            if (conversation.Type == ConversationType.DirectChat)
            {
                await sendMessageCache.OnCanSendRemovedAsync(userId, conversation.Id);
                await sendMessageCache.OnCanSendRemovedAsync(targetUserId, conversation.Id);
            }
        }
        
        // ============ Database operasjon ============
        
        var userBlock = new UserBlock
        {
            BlockerId = userId,
            BlockedUserId = targetUserId
        };

        await userBlockRepository.AddAsync(userBlock);
        
        // ============ POST-COMMIT: SyncEvent ============
        // Brukeren havner i en blokkeringsliste i frontend

        await syncService.CreateSyncEventsAsync([userId], SyncEventType.UserBlocked, targetUserId);

        return Result.Success();
    }
    
    /// <inheritdoc />
    public async Task<Result> UnblockUserAsync(string userId, string targetUserId)
    {
        // ============ Validering ============
        // Sjekker at brukeren som skal fjerne blokkeringen eksisterer
        var user = await userManager.FindByIdAsync(userId);
        if (user == null)
        {
            logger.LogWarning("Unblock failed: requesting user {UserId} not found", userId);
            return Result.Failure("User not found", ErrorTypeEnum.NotFound);
        }
        
        // Sjekker at brukeren og targetUserId ikke er like
        if (userId == targetUserId)
        {
            logger.LogWarning("Unblock failed: User {UserId} cant unblock itself", userId);
            return Result.Failure("You cannot unblock yourself", ErrorTypeEnum.BadRequest);
        }
        
        // Sjekker at brukeren vi skal fjerne blokkering av eksisterer
        var targetUser = await userManager.FindByIdAsync(targetUserId);
        if (targetUser == null)
        {
            logger.LogWarning("Unblock failed: target user {TargetUserId} not found, requested by {UserId}", 
                targetUserId, userId);
            return Result.Failure("User not found", ErrorTypeEnum.NotFound);
        }

        var userBlock = await userBlockRepository.GetAsync(userId, targetUserId);

        if (userBlock == null)
        {
            logger.LogWarning("User {UserId} tried to unblock user {TargetUserId} that is not previously blocked", 
                userId, targetUserId);
            return Result.Failure("You have not blocked this user", ErrorTypeEnum.Conflict);
        }
        
        // ============ Fjern fra CanSend ============
        
        // Vi sjekker om det er en samtale blandt brukerene
        var conversation = await conversationRepository.GetConversationBetweenUsersAsync(userId, targetUserId);
        if (conversation != null)
        {
            // Hvis samtalen ikke er pending og godkjent så legger vi den til i CanSend
            if (conversation.Type == ConversationType.DirectChat)
            {
                // Sjekk at den andre brukeren ikke også har blokkert oss
                var reverseBlock = await userBlockRepository.GetAsync(targetUserId, userId);
                if (reverseBlock == null)
                {
                    await sendMessageCache.OnCanSendAddedAsync(userId, conversation.Id);
                    await sendMessageCache.OnCanSendAddedAsync(targetUserId, conversation.Id);
                }
            }
        }
        
        // ============ Database operasjon ============

        await userBlockRepository.DeleteAsync(userBlock);
        
        // ============ POST-COMMIT: SyncEvent ============
        // Brukeren havner i en blokkeringsliste i frontend

        await syncService.CreateSyncEventsAsync([userId], SyncEventType.UserUnblocked, targetUserId);

        return Result.Success();
    }
    
    // ================================ VALIDERINGER ================================
    /// <inheritdoc />
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
    
    /// <inheritdoc />
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
