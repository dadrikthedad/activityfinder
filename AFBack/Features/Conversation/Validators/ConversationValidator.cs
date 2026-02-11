using AFBack.Common;
using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Features.Conversation.Models;
using AFBack.Models.Enums;

namespace AFBack.Features.Conversation.Validators;

public class ConversationValidator(
    ILogger<ConversationValidator> logger) : IConversationValidator
{
    // ============ ENKELT-VALIDERINGER ============
    
    // Sjekk interface for summary
    public Result<Models.Conversation> ValidateConversationExists(
        string userId, 
        int conversationId, 
        Models.Conversation? conversation)
    {
        if (conversation == null)
        {
            logger.LogError("User {UserId} tried to access non-existent conversation {ConversationId}",
                userId, conversationId);
            return Result<Models.Conversation>.Failure("Conversation not found", ErrorTypeEnum.NotFound);
        }
        
        return Result<Models.Conversation>.Success(conversation);
    }
    
    // Sjekk interface for summary
    public Result<ConversationParticipant> ValidateParticipant(
        string userId,
        Models.Conversation conversation)
    {
        var participant = conversation.Participants.FirstOrDefault(p => p.UserId == userId);
        
        if (participant == null)
        {
            logger.LogError("User {UserId} tried to access conversation {ConversationId} without being a participant",
                userId, conversation.Id);
            return Result<ConversationParticipant>.Failure("Conversation not found", ErrorTypeEnum.Forbidden);
        }
        
        return Result<ConversationParticipant>.Success(participant);
    }
    
    // Sjekk interface for summary
    public Result ValidateParticipantAccepted(ConversationParticipant participant)
    {
        if (participant.Status != ConversationStatus.Accepted)
        {
            logger.LogWarning(
                "User {UserId} tried to perform action on conversation {ConversationId} but has status {Status}",
                participant.UserId, participant.ConversationId, participant.Status);
            return Result.Failure("You must accept the conversation first", ErrorTypeEnum.Forbidden);
        }
        
        return Result.Success();
    }
    
    // Sjekk interface for summary
    public Result ValidateParticipantPending(ConversationParticipant participant)
    {
        if (participant.Status == ConversationStatus.Accepted)
        {
            logger.LogWarning(
                "User {UserId} tried to accept/reject conversation {ConversationId} but has already accepted",
                participant.UserId, participant.ConversationId);
            return Result.Failure("You have already accepted this conversation", ErrorTypeEnum.BadRequest);
        }
        
        if (participant.Status == ConversationStatus.Rejected)
        {
            logger.LogWarning(
                "User {UserId} tried to accept/reject conversation {ConversationId} but has already rejected",
                participant.UserId, participant.ConversationId);
            return Result.Failure("You have already rejected this conversation", ErrorTypeEnum.BadRequest);
        }
        
        return Result.Success();
    }
    
    // Sjekk interface for summary
    public Result ValidateIsGroupChat(string userId, Models.Conversation conversation)
    {
        if (conversation.Type != ConversationType.GroupChat)
        {
            logger.LogError(
                "User {UserId} tried to perform group action on conversation {ConversationId} that is not a group (Type: {Type})",
                userId, conversation.Id, conversation.Type);
            return Result.Failure("This endpoint is only for group conversations", ErrorTypeEnum.BadRequest);
        }
        
        return Result.Success();
    }
    
    // Sjekk interface for summary
    public Result ValidateIsPendingRequest(string userId, Models.Conversation conversation)
    {
        if (conversation.Type != ConversationType.PendingRequest)
        {
            logger.LogError(
                "User {UserId} tried to accept/reject conversation {ConversationId} that is not pending (Type: {Type})",
                userId, conversation.Id, conversation.Type);
            return Result.Failure("Conversation is not a pending request", ErrorTypeEnum.BadRequest);
        }
        
        return Result.Success();
    }
    
    // Sjekk interface for summary
    public Result ValidateIsNotGroupChat(string userId, Models.Conversation conversation)
    {
        if (conversation.Type == ConversationType.GroupChat)
        {
            logger.LogError(
                "User {UserId} tried to perform 1-1 action on group conversation {ConversationId}",
                userId, conversation.Id);
            return Result.Failure("Wrong endpoint for group conversations", ErrorTypeEnum.BadRequest);
        }
        
        return Result.Success();
    }
    
    // Sjekk interface for summary
    public Result ValidateNotArchived(ConversationParticipant participant)
    {
        if (participant.ConversationArchived)
        {
            logger.LogWarning(
                "User {UserId} tried to perform action on archived conversation {ConversationId}",
                participant.UserId, participant.ConversationId);
            return Result.Failure(
                "You cannot perform this action on a conversation you have deleted", 
                ErrorTypeEnum.Gone);
        }
        
        return Result.Success();
    }
    
    // Sjekk interface for summary
    public Result ValidateIsArchived(ConversationParticipant participant)
    {
        if (!participant.ConversationArchived)
        {
            logger.LogWarning(
                "User {UserId} tried to restore non-archived conversation {ConversationId}",
                participant.UserId, participant.ConversationId);
            return Result.Failure(
                "You have not deleted this conversation", 
                ErrorTypeEnum.BadRequest);
        }
        
        return Result.Success();
    }
    
    // Sjekk interface for summary
    public Result ValidateIsPendingRecipient(ConversationParticipant participant)
    {
        if (participant.Role != ParticipantRole.PendingRecipient)
        {
            logger.LogWarning(
                "User {UserId} tried to accept/reject conversation {ConversationId} but is not the recipient (Role: {Role})",
                participant.UserId, participant.ConversationId, participant.Role);
            return Result.Failure(
                "You cannot perform this action on a conversation you initiated", 
                ErrorTypeEnum.Forbidden);
        }
        
        return Result.Success();
    }
    
    // Sjekk interface for summary
    public Result ValidateUserExists(string userId, bool exists)
    {
        if (!exists)
        {
            logger.LogWarning("Attempted action with non-existent user {UserId}", userId);
            return Result.Failure("User not found", ErrorTypeEnum.NotFound);
        }
        
        return Result.Success();
    }
    
    // Sjekk interface for summary
    public Result ValidateIsCreator(ConversationParticipant participant)
    {
        if (participant.Role != ParticipantRole.Creator)
        {
            logger.LogWarning(
                "User {UserId} tried to perform creator action on conversation {ConversationId} but has role {Role}",
                participant.UserId, participant.ConversationId, participant.Role);
            return Result.Failure(
                "Only the group creator can perform this action", 
                ErrorTypeEnum.Forbidden);
        }
        
        return Result.Success();
    }
    
    // ============ KOMBINERTE VALIDERINGER ============
    
    // Sjekk interface for summary
    public Result<ConversationParticipant> ValidatePendingRequestAction(
        string userId,
        int conversationId,
        Models.Conversation? conversation)
    {
        // Sjekker at samtalen eksisterer
        var conversationResult = ValidateConversationExists(userId, conversationId, conversation);
        if (conversationResult.IsFailure)
            return Result<ConversationParticipant>.Failure(conversationResult.Error, conversationResult.ErrorType);
        
        // Validerer at det er en pending request
        var pendingRequestResult = ValidateIsPendingRequest(userId, conversation!);
        if (pendingRequestResult.IsFailure)
            return Result<ConversationParticipant>.Failure(pendingRequestResult.Error, pendingRequestResult.ErrorType);
        
        // Validerer at brukeren er medlem av samtalen
        var participantResult = ValidateParticipant(userId, conversation!);
        if (participantResult.IsFailure)
            return Result<ConversationParticipant>.Failure(participantResult.Error, participantResult.ErrorType);
        
        var userParticipant = participantResult.Value!;
        
        // Sjekk at brukeren er mottakeren (PendingRecipient)
        var recipientResult = ValidateIsPendingRecipient(userParticipant);
        if (recipientResult.IsFailure)
            return Result<ConversationParticipant>.Failure(
                "You cannot perform this action on a conversation you initiated", recipientResult.ErrorType);
        
        // Sjekker at brukeren har pending status (ikke allerede akseptert)
        var pendingResult = ValidateParticipantPending(userParticipant);
        if (pendingResult.IsFailure)
            return Result<ConversationParticipant>.Failure(pendingResult.Error, pendingResult.ErrorType);
        
        return Result<ConversationParticipant>.Success(userParticipant);
    }
    
    // Sjekk interface for summary
    public Result<ConversationParticipant> ValidatePendingGroupInviteAction(
        string userId,
        int conversationId,
        Models.Conversation? conversation)
    {
        // Sjekker at samtalen eksisterer
        var conversationResult = ValidateConversationExists(userId, conversationId, conversation);
        if (conversationResult.IsFailure)
            return Result<ConversationParticipant>.Failure(conversationResult.Error, conversationResult.ErrorType);
        
        // Validerer at det er en gruppesamtale
        var groupChatResult = ValidateIsGroupChat(userId, conversation!);
        if (groupChatResult.IsFailure)
            return Result<ConversationParticipant>.Failure(groupChatResult.Error, groupChatResult.ErrorType);
        
        // Validerer at brukeren er medlem av samtalen
        var participantResult = ValidateParticipant(userId, conversation!);
        if (participantResult.IsFailure)
            return Result<ConversationParticipant>.Failure(participantResult.Error, participantResult.ErrorType);
        
        var userParticipant = participantResult.Value!;
        
        // Sjekker at brukeren har pending status (ikke allerede akseptert)
        var pendingResult = ValidateParticipantPending(userParticipant);
        if (pendingResult.IsFailure)
            return Result<ConversationParticipant>.Failure(pendingResult.Error, pendingResult.ErrorType);
        
        return Result<ConversationParticipant>.Success(userParticipant);
    }
    
    // Sjekk interface for summary
    public Result<ConversationParticipant> ValidateGroupMemberAction(
        string userId,
        int conversationId,
        Models.Conversation? conversation)
    {
        // Sjekker at samtalen eksisterer
        var conversationResult = ValidateConversationExists(userId, conversationId, conversation);
        if (conversationResult.IsFailure)
            return Result<ConversationParticipant>.Failure(conversationResult.Error, conversationResult.ErrorType);
        
        // Validerer at det er en gruppesamtale
        var groupChatResult = ValidateIsGroupChat(userId, conversation!);
        if (groupChatResult.IsFailure)
            return Result<ConversationParticipant>.Failure(groupChatResult.Error, groupChatResult.ErrorType);
        
        // Validerer at brukeren er medlem av samtalen
        var participantResult = ValidateParticipant(userId, conversation!);
        if (participantResult.IsFailure)
            return Result<ConversationParticipant>.Failure(participantResult.Error, participantResult.ErrorType);
        
        var userParticipant = participantResult.Value!;
        
        // Sjekker at brukeren har Accepted status
        var acceptedResult = ValidateParticipantAccepted(userParticipant);
        if (acceptedResult.IsFailure)
            return Result<ConversationParticipant>.Failure(acceptedResult.Error, acceptedResult.ErrorType);
        
        return Result<ConversationParticipant>.Success(userParticipant);
    }
    
    // Sjekk interface for summary
    public Result<ConversationParticipant> ValidateGroupCreatorAction(
        string userId,
        int conversationId,
        Models.Conversation? conversation)
    {
        // Sjekker at samtalen eksisterer
        var conversationResult = ValidateConversationExists(userId, conversationId, conversation);
        if (conversationResult.IsFailure)
            return Result<ConversationParticipant>.Failure(conversationResult.Error, conversationResult.ErrorType);
        
        // Validerer at det er en gruppesamtale
        var groupChatResult = ValidateIsGroupChat(userId, conversation!);
        if (groupChatResult.IsFailure)
            return Result<ConversationParticipant>.Failure(groupChatResult.Error, groupChatResult.ErrorType);
        
        // Validerer at brukeren er medlem av samtalen
        var participantResult = ValidateParticipant(userId, conversation!);
        if (participantResult.IsFailure)
            return Result<ConversationParticipant>.Failure(participantResult.Error, participantResult.ErrorType);
        
        var userParticipant = participantResult.Value!;
        
        // Sjekker at brukeren har Accepted status
        var acceptedResult = ValidateParticipantAccepted(userParticipant);
        if (acceptedResult.IsFailure)
            return Result<ConversationParticipant>.Failure(acceptedResult.Error, acceptedResult.ErrorType);
        
        // Sjekker at brukeren er Creator
        var creatorResult = ValidateIsCreator(userParticipant);
        if (creatorResult.IsFailure)
            return Result<ConversationParticipant>.Failure(creatorResult.Error, creatorResult.ErrorType);
        
        return Result<ConversationParticipant>.Success(userParticipant);
    }
    
    // Sjekk interface for summary
    public Result<ConversationParticipant> ValidateArchiveAction(
        string userId,
        int conversationId,
        Models.Conversation? conversation)
    {
        // Sjekker at samtalen eksisterer
        var conversationResult = ValidateConversationExists(userId, conversationId, conversation);
        if (conversationResult.IsFailure)
            return Result<ConversationParticipant>.Failure(conversationResult.Error, conversationResult.ErrorType);
        
        // Validerer at brukeren er medlem av samtalen
        var participantResult = ValidateParticipant(userId, conversation!);
        if (participantResult.IsFailure)
            return Result<ConversationParticipant>.Failure(participantResult.Error, participantResult.ErrorType);
        
        var userParticipant = participantResult.Value!;
        
        // Sjekker at brukeren ikke allerede har arkivert samtalen
        var notArchivedResult = ValidateNotArchived(userParticipant);
        if (notArchivedResult.IsFailure)
            return Result<ConversationParticipant>.Failure(
                "You have already deleted this conversation", notArchivedResult.ErrorType);
        
        // Validerer at det IKKE er en gruppesamtale
        var notGroupResult = ValidateIsNotGroupChat(userId, conversation!);
        if (notGroupResult.IsFailure)
            return Result<ConversationParticipant>.Failure(notGroupResult.Error, notGroupResult.ErrorType);
        
        return Result<ConversationParticipant>.Success(userParticipant);
    }
    
    // Sjekk interface for summary
    public Result<ConversationParticipant> ValidateRestoreArchiveAction(
        string userId,
        int conversationId,
        Models.Conversation? conversation)
    {
        // Sjekker at samtalen eksisterer
        var conversationResult = ValidateConversationExists(userId, conversationId, conversation);
        if (conversationResult.IsFailure)
            return Result<ConversationParticipant>.Failure(conversationResult.Error, conversationResult.ErrorType);
        
        // Validerer at brukeren er medlem av samtalen
        var participantResult = ValidateParticipant(userId, conversation!);
        if (participantResult.IsFailure)
            return Result<ConversationParticipant>.Failure(participantResult.Error, participantResult.ErrorType);
        
        var userParticipant = participantResult.Value!;
        
        // Sjekker at brukeren har arkivert samtalen
        var archivedResult = ValidateIsArchived(userParticipant);
        if (archivedResult.IsFailure)
            return Result<ConversationParticipant>.Failure(archivedResult.Error, archivedResult.ErrorType);
        
        // Validerer at det IKKE er en gruppesamtale
        var notGroupResult = ValidateIsNotGroupChat(userId, conversation!);
        if (notGroupResult.IsFailure)
            return Result<ConversationParticipant>.Failure(notGroupResult.Error, notGroupResult.ErrorType);
        
        return Result<ConversationParticipant>.Success(userParticipant);
    }
}
