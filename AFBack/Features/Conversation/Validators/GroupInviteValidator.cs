using AFBack.Cache;
using AFBack.Common;
using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Features.Blocking;
using AFBack.Features.Blocking.Services;
using AFBack.Features.Conversation.Repository;

namespace AFBack.Features.Conversation.Validators;

public class GroupInviteValidator(
    ILogger<GroupInviteValidator> logger,
    IUserSummaryCacheService userSummariesCache,
    IBlockingService blockingService,
    IConversationLeftRecordRepository conversationLeftRecordRepository) : IGroupInviteValidator
{
    // Sjekk interface for summary
    public async Task<Result> ValidateInviteAsync(
        string inviterId,
        List<string> receiverIds,
        int? conversationId = null,
        HashSet<string>? existingParticipantIds = null)
    {
        // ============ VALIDERING: Duplikater ============
        
        var uniqueReceiverIds = receiverIds.Distinct().ToList();
        if (uniqueReceiverIds.Count != receiverIds.Count)
        {
            var duplicateIds = receiverIds
                .GroupBy(id => id)
                .Where(g => g.Count() > 1)
                .Select(g => g.Key)
                .ToList();
            
            logger.LogWarning("User {UserId} provided duplicate receiver IDs: {DuplicateIds}",
                inviterId, string.Join(", ", duplicateIds));
            return Result.Failure(
                $"Duplicate user IDs in receiver list. Users: {string.Join(", ", duplicateIds)}");
        }
        
        // ============ VALIDERING: Inviterer seg selv ============
        
        if (uniqueReceiverIds.Contains(inviterId))
        {
            logger.LogWarning("User {UserId} tried to include themselves in invite list", inviterId);
            return Result.Failure("You cannot invite yourself");
        }
        
        // ============ VALIDERING: Brukere eksisterer ============
        
        var users = await userSummariesCache.GetUserSummariesAsync(uniqueReceiverIds);
        var nonExistentReceivers = uniqueReceiverIds.Where(id => !users.ContainsKey(id)).ToList();
        
        if (nonExistentReceivers.Any())
        {
            logger.LogWarning("User {UserId} tried to invite non-existent users: {UserIds}",
                inviterId, string.Join(", ", nonExistentReceivers));
            return Result.Failure(
                $"One or more users do not exist. Users: {string.Join(", ", nonExistentReceivers)}",
                ErrorTypeEnum.NotFound);
        }
        
        // ============ VALIDERING: Allerede participant (kun ved eksisterende gruppe) ============
        
        if (existingParticipantIds != null)
        {
            var alreadyParticipants = uniqueReceiverIds
                .Where(id => existingParticipantIds.Contains(id))
                .ToList();
            
            if (alreadyParticipants.Any())
            {
                logger.LogWarning(
                    "User {UserId} tried to invite users already in group {ConversationId}: {UserIds}",
                    inviterId, conversationId, string.Join(", ", alreadyParticipants));
                return Result.Failure(
                    $"Users already in group. Users: {string.Join(", ", alreadyParticipants)}");
            }
        }
        
        // ============ VALIDERING: ConversationLeftRecord (kun ved eksisterende gruppe) ============
        
        if (conversationId.HasValue)
        {
            var usersWhoLeft = new List<string>();
            foreach (var receiverId in uniqueReceiverIds)
            {
                if (await conversationLeftRecordRepository.ExistsAsync(receiverId, conversationId.Value))
                {
                    usersWhoLeft.Add(receiverId);
                }
            }
            
            if (usersWhoLeft.Any())
            {
                logger.LogWarning(
                    "User {UserId} tried to invite users who left group {ConversationId}: {UserIds}",
                    inviterId, conversationId, string.Join(", ", usersWhoLeft));
                return Result.Failure(
                    $"Cannot invite users who have left the group. Users: {string.Join(", ", usersWhoLeft)}",
                    ErrorTypeEnum.Forbidden);
            }
        }
        
        // ============ VALIDERING: Blokkeringer ============
        
        var blockedUsers = new List<string>();
        
        foreach (var receiverId in uniqueReceiverIds)
        {
            var blockResult = await blockingService.ValidateNoBlockingsAsync(inviterId, receiverId);
            if (blockResult.IsFailure)
            {
                blockedUsers.Add(receiverId);
            }
        }
        
        if (blockedUsers.Any())
        {
            logger.LogWarning(
                "User {UserId} cannot invite: {Count} blocked users",
                inviterId, blockedUsers.Count);
            return Result.Failure(
                $"Cannot invite blocked users. Users: {string.Join(", ", blockedUsers)}",
                ErrorTypeEnum.Forbidden);
        }
        
        return Result.Success();
    }
}
