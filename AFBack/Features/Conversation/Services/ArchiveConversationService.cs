using AFBack.Cache;
using AFBack.Common;
using AFBack.Common.Results;
using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.Conversation.Repository;
using AFBack.Features.Conversation.Validators;
using AFBack.Features.SyncEvents.Enums;
using AFBack.Features.SyncEvents.Services;
using AFBack.Models.Enums;

namespace AFBack.Features.Conversation.Services;

public class ArchiveConversationService(
    ILogger<ArchiveConversationService> logger,
    IConversationRepository conversationRepository,
    IConversationValidator conversationValidator,
    ISyncService syncService,
    ISendMessageCache sendMessageCache,
    IGetConversationsService getConversationService) : IArchiveConversationService
{
    // Sjekk interface for summary
    public async Task<Result> ArchiveConversationAsync(string userId, int conversationId)
    {
        // ============ VALIDERING ============
        
        var conversation = await conversationRepository.GetConversationWithTrackingAsync(conversationId);
        
        // Sjekker at samtalen eksisterer
        var conversationResult = conversationValidator.ValidateConversationExists(userId, conversationId, conversation);
        if (conversationResult.IsFailure)
            return Result.Failure(conversationResult.Error, conversationResult.ErrorType);
        
        // Validerer at brukeren er medlem av samtalen
        var participantResult = conversationValidator.ValidateParticipant(userId, conversation!);
        if (participantResult.IsFailure)
            return Result.Failure(participantResult.Error, participantResult.ErrorType);
        
        var participant = participantResult.Value!;
        
        // Sjekker at brukeren ikke allerede har arkivert samtalen
        var notArchivedResult = conversationValidator.ValidateNotArchived(participant);
        if (notArchivedResult.IsFailure)
            return Result.Failure("You have already deleted this conversation", notArchivedResult.ErrorType);
        
        // Feil endepunkt for gruppesamtaler
        var notGroupResult = conversationValidator.ValidateIsNotGroupChat(userId, conversation!);
        if (notGroupResult.IsFailure)
            return Result.Failure(notGroupResult.Error, notGroupResult.ErrorType);
        
        // ============ DATABASE: Oppdater ============
        
        participant.ConversationArchived = true;
        participant.ArchivedAt = DateTime.UtcNow;
        
        // Sletter fra CanSend
        var allParticipantsIds = conversation!.Participants.Select(cp => cp.UserId);
        foreach (var participantId in allParticipantsIds)
        {
            try
            {
                await sendMessageCache.OnCanSendRemovedAsync(participantId, conversationId);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error during deleting from CanSend. " +
                                    "AppUser: {UserId}, Conversations: {ConversationId}", userId, conversationId);
            }
        }
        
        // Lagrer samtalen
        await conversationRepository.SaveChangesAsync();
        
        logger.LogInformation("User {UserId} successfully archived conversation {ConversationId}", 
            userId, conversationId);
        
        // ============ POST-COMMIT: SyncEvent ============
        
        try
        {
            await syncService.CreateSyncEventsAsync([userId], SyncEventType.ConversationArchived, 
                conversationId);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, 
                "Failed to create sync event for archived conversation {ConversationId}, " +
                "but conversation was archived successfully", 
                conversationId);
        }
        
        return Result.Success();
    }
    
    // Sjekk interface for summary
    public async Task<Result<ConversationResponse>> RestoreArchivedConversationAsync(string userId, int conversationId)
    {
        // ============ VALIDERING ============
        
        var conversation = await conversationRepository.GetConversationWithTrackingAsync(conversationId);
        
        // Sjekker at samtalen eksisterer
        var conversationResult = conversationValidator.ValidateConversationExists(userId, conversationId, conversation);
        if (conversationResult.IsFailure)
            return Result<ConversationResponse>.Failure(conversationResult.Error, conversationResult.ErrorType);
        
        // Validerer at brukeren er medlem av samtalen
        var participantResult = conversationValidator.ValidateParticipant(userId, conversation!);
        if (participantResult.IsFailure)
            return Result<ConversationResponse>.Failure(participantResult.Error, participantResult.ErrorType);
        
        var participant = participantResult.Value!;
        
        // Sjekker at brukeren har arkivert samtalen
        var archivedResult = conversationValidator.ValidateIsArchived(participant);
        if (archivedResult.IsFailure)
            return Result<ConversationResponse>.Failure(archivedResult.Error, archivedResult.ErrorType);
        
        // Feil endepunkt for gruppesamtaler
        var notGroupResult = conversationValidator.ValidateIsNotGroupChat(userId, conversation!);
        if (notGroupResult.IsFailure)
            return Result<ConversationResponse>.Failure(notGroupResult.Error, notGroupResult.ErrorType);
        
        // Henter den andre brukern i samtalen for Syncevent og CanSend
        var otherParticipant = conversation!.Participants.FirstOrDefault(cp => cp.UserId != userId);
        
        if (otherParticipant == null)
        {
            logger.LogCritical("User {UserId} is trying to restore conversation {ConversationId} and there is no" +
                               " other participants in the conversation" ,
                userId, conversationId);
            return Result<ConversationResponse>.Failure("Server error. Try again later or contact support",
                ErrorTypeEnum.InternalServerError); 
        }
        
        // ============ DATABASE: Oppdater ============
        
        participant.ConversationArchived = false;
        participant.ArchivedAt = null;
        
        // Legger til CanSend igjen hvis begge brukerne har akseptert samtalen
        try
        {
            if (otherParticipant.Status == ConversationStatus.Accepted)
            {  
                await sendMessageCache.OnCanSendAddedAsync(otherParticipant.UserId, conversationId);
                await sendMessageCache.OnCanSendAddedAsync(participant.UserId, conversationId);
            }
        }
        catch (Exception ex)
        { 
            logger.LogError(ex, "Error during adding to CanSend. " +
                                  "AppUser: {UserId}, Conversations: {ConversationId}", userId, conversationId);
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
            return Result<ConversationResponse>.Failure(
                "Server error. Try again later or contact support", 
                ErrorTypeEnum.InternalServerError);
        }
        
        var response = result.Value!;
        
        // ============ POST-COMMIT: SyncEvent ============
        
        try
        {
            await syncService.CreateSyncEventsAsync([userId], SyncEventType.ConversationRestored, 
                response);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, 
                "Failed to create sync event for restored conversation {ConversationId}, " +
                "but conversation was restored successfully", 
                conversationId);
        }
        
        return Result<ConversationResponse>.Success(response);
    }
}
