using AFBack.Common;
using AFBack.Common.Results;
using AFBack.Features.Blocking;
using AFBack.Features.Blocking.Services;
using AFBack.Features.Conversation.Repository;
using AFBack.Features.Conversation.Validators;
using AFBack.Features.Messaging.DTOs.Request;
using AFBack.Features.Messaging.Interface;
using AFBack.Features.Messaging.Repository;
using AFBack.Models.Enums;

namespace AFBack.Features.Messaging.Validators;

public class SendMessageValidator(
    IMessageRepository messageRepository,
    IConversationRepository conversationRepository,
    IConversationValidator conversationValidator,
    IBlockingService blockingService,
    ILogger<SendMessageValidator> logger) : ISendMessageValidator
{
    
    /// <summary>
    /// Hovedvalideringsmetoden som kaller de andre valideringene. Brukes i SendMessageAsync.
    /// </summary>
    /// <param name="request">SendMessageRequest</param>
    /// <param name="senderId">Brukeren som sender melding</param>
    /// <returns>Result med success eller result med errorMessage</returns>
    public async Task<Result> ValidateSendMessageAsync(string senderId, MessageRequest request)
    {
        // Henter samtalen
        var conversation = await conversationRepository.GetConversationAsync(request.ConversationId);
        
        // Sjekker at samtalen eksisterer
        var conversationResult = conversationValidator.ValidateConversationExists(
            senderId, request.ConversationId, conversation);
        if (conversationResult.IsFailure)
            return Result.Failure(conversationResult.Error, conversationResult.ErrorType);
        
        // Sjekker at vi er participant, har godkjent samtalen og ikke har slettet samtalen
        var userParticipantsResult = ValidateUserParticipant(senderId, conversation!);
        if (userParticipantsResult.IsFailure)
            return userParticipantsResult;
        
        // sjekker at ParentMessage eksisterer
        if (request.ParentMessageId.HasValue)
        {
            var parentMessageResult = await ValidateParentMessageExists(senderId, request.ParentMessageId.Value);
            if (parentMessageResult.IsFailure)
                return parentMessageResult;
        }

        // Validerer pending 1-1 samtaler (blokkeringer og pending message limit)
        if (conversation!.Type == ConversationType.PendingRequest)
        {
            var pendingResult = await ValidatePendingConversation(senderId, conversation);
            if (pendingResult.IsFailure)
                return pendingResult;
        }

        return Result.Success();
    }
    
    /// <summary>
    /// Validerer at brukeren er participant, ikke har arkivert samtalen og har akseptert den.
    /// </summary>
    private Result ValidateUserParticipant(string senderId, Conversation.Models.Conversation conversation)
    {
        // Sjekker at vi er en participant i samtalen
        var participantResult = conversationValidator.ValidateParticipant(senderId, conversation);
        if (participantResult.IsFailure)
            return Result.Failure(participantResult.Error, participantResult.ErrorType);
        
        var participant = participantResult.Value!;
        
        // Sjekker at sender ikke har arkivert samtalen
        var archivedResult = conversationValidator.ValidateNotArchived(participant);
        if (archivedResult.IsFailure)
            return archivedResult;
        
        // Sjekker at sender har akseptert samtalen
        var acceptedResult = conversationValidator.ValidateParticipantAccepted(participant);
        if (acceptedResult.IsFailure)
            return acceptedResult;

        return Result.Success();
    }

    /// <summary>
    /// Sjekker at ParentMessage eksisterer
    /// </summary>
    private async Task<Result> ValidateParentMessageExists(string userId, int parentMessageId)
    {
        // Sjekk i databasen om å finne denne messageIden
        var parentExists = await messageRepository.MessageExistsAsync(parentMessageId);

        if (!parentExists)
        {
            logger.LogWarning("User {UserId} attempted to reply to non-existing parent message {ParentMessageId}", 
                userId, parentMessageId);
            return Result.Failure("Parent Message not found", ErrorTypeEnum.NotFound);
        }

        return Result.Success();
    }
    
    /// <summary>
    /// Validerer pending 1-1 samtaler: blokkeringer, mottaker arkivert, og pending message limit.
    /// </summary>
    private async Task<Result> ValidatePendingConversation(string userId, Conversation.Models.Conversation conversation)
    {
        // Henter mottakeren i 1-1 samtalen
        var messageReceiver = conversation.Participants
            .FirstOrDefault(p => p.UserId != userId);

        // Sjekker at det finnes en mottaker
        if (messageReceiver == null)
        {
            logger.LogCritical(
                "Data integrity error: No receiver found in 1-1 conversation {ConversationId} for sender {UserId}",
                conversation.Id, userId);
            throw new InvalidOperationException("Conversation data is corrupted. Please contact support.");
        }

        // Sjekker blokkeringer begge veier
        var blockResult = await blockingService.ValidateNoBlockingsAsync(userId, messageReceiver.UserId);
        if (blockResult.IsFailure)
            return blockResult;
        
        // Sjekker om mottaker har arkivert samtalen
        if (messageReceiver.ConversationArchived)
        {
            logger.LogWarning(
                "User {UserId} cannot send to user {ReceiverId} in conversation {ConversationId}. " +
                "ReceiverArchived: true", userId, messageReceiver.UserId, conversation.Id);
            return Result.Failure(
                "This user has been deleted, is no longer visible, " +
                "or you lack the required permission to send messages.", ErrorTypeEnum.Forbidden);
        }
        
        // Sjekker pending message limit (maks 5 meldinger før mottaker aksepterer)
        if (messageReceiver.PendingMessagesReceived >= 5)
        {
            logger.LogWarning(
                "User {UserId} attempted to send message but receiver {ReceiverId} has reached message " +
                "limit ({Count}/5)", userId, messageReceiver.UserId, messageReceiver.PendingMessagesReceived);
            return Result.Failure(
                "Cannot send more messages until the recipient accepts your request",
                ErrorTypeEnum.Forbidden);
        }

        return Result.Success();
    }
}
