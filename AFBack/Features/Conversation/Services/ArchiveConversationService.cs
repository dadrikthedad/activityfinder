using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Features.Broadcast.Services.Interfaces;
using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.Conversation.Enums;
using AFBack.Features.Conversation.Repository;
using AFBack.Features.Conversation.Validators;
using AFBack.Infrastructure.Cache;

namespace AFBack.Features.Conversation.Services;

public class ArchiveConversationService(
    ILogger<ArchiveConversationService> logger,
    IConversationRepository conversationRepository,
    IConversationValidator conversationValidator,
    IConversationBroadcastService broadcastService,
    ICanSendCache canSendCache,
    IGetConversationsService getConversationService) : IArchiveConversationService
{
    /// <inheritdoc />
    public async Task<Result> ArchiveConversationAsync(string userId, int conversationId)
    {
        // Henter samtalen
        var conversation = await conversationRepository.GetConversationWithTrackingAsync(conversationId);
        
        // ============ VALIDERING ============
        
        var validationResult = conversationValidator.ValidateArchiveAction(userId, conversationId, conversation);
        if (validationResult.IsFailure)
            return Result.Failure(validationResult.Error, validationResult.ErrorCode);
        
        var participant = validationResult.Value!;
        
        // ============ DATABASE: Oppdater ============
        
        participant.ConversationArchived = true;
        participant.ArchivedAt = DateTime.UtcNow;
        
        // Sletter fra CanSend
        var allParticipantsIds = conversation!.Participants.Select(cp => cp.UserId);
        foreach (var participantId in allParticipantsIds)
        {
            await canSendCache.OnCanSendRemovedAsync(participantId, conversationId);
        }
        
        // Lagrer samtalen
        await conversationRepository.SaveChangesAsync();
        
        logger.LogInformation("User {UserId} successfully archived conversation {ConversationId}", 
            userId, conversationId);
        
        // ============ POST-COMMIT: Broadcast ============
        
        await broadcastService.BroadcastConversationArchivedAsync(userId, conversationId);
        
        return Result.Success();
    }
    
    /// <inheritdoc />
    public async Task<Result<ConversationResponse>> RestoreArchivedConversationAsync(string userId, int conversationId)
    {
        // Henter samtalen   
        var conversation = await conversationRepository.GetConversationWithTrackingAsync(conversationId);
        
        // ============ VALIDERING ============
        
        var validationResult = conversationValidator.ValidateRestoreArchiveAction(userId, conversationId, conversation);
        if (validationResult.IsFailure)
            return Result<ConversationResponse>.Failure(validationResult.Error, validationResult.ErrorCode);
        
        var participant = validationResult.Value!;
        
        // Henter den andre brukern i samtalen for Syncevent og CanSend
        var otherParticipant = conversation!.Participants.FirstOrDefault(cp => cp.UserId != userId);
        
        if (otherParticipant == null)
        {
            logger.LogCritical("User {UserId} is trying to restore conversation {ConversationId} and there is no" +
                               " other participants in the conversation" , userId, conversationId);
            return Result<ConversationResponse>.Failure("Server error. Try again later or contact support",
                AppErrorCode.InternalError); 
        }
        
        // ============ DATABASE: Oppdater ============
        
        participant.ConversationArchived = false;
        participant.ArchivedAt = null;
        
        // Legger til CanSend igjen hvis begge brukerne har akseptert samtalen
        if (otherParticipant.Status == ConversationStatus.Accepted)
        {  
            await canSendCache.OnCanSendAddedAsync(otherParticipant.UserId, conversationId);
            await canSendCache.OnCanSendAddedAsync(participant.UserId, conversationId);
        }
        
        
        // Lagrer samtalen
        await conversationRepository.SaveChangesAsync();
        
        logger.LogInformation("User {UserId} successfully restored conversation {ConversationId}", 
            userId, conversationId);
        
        // ============ HENT DATA FOR RESPONSE ============
        
        var result = await getConversationService.GetConversationAsync(userId, conversationId);
        
        if (result.IsFailure)
        {
            logger.LogCritical(
                "Failed to retrieve conversation after restoring. User {UserId}, Conversation {ConversationId}. " +
                "Error: {Error}",
                userId, conversationId, result.Error);
            return Result<ConversationResponse>.Failure("Server error. Try again later or contact support", 
                AppErrorCode.InternalError);
        }
        
        var response = result.Value!;
        
        // ============ POST-COMMIT: Broadcast ============
        
        await broadcastService.BroadcastConversationRestoredAsync(userId, response);
        
        return Result<ConversationResponse>.Success(response);
    }
}
