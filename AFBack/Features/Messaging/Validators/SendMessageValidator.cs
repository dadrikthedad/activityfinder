
using AFBack.Common;
using AFBack.Common.Results;
using AFBack.Features.Conversation.Repository;
using AFBack.Features.Messaging.DTOs;
using AFBack.Features.Messaging.DTOs.Request;
using AFBack.Features.Messaging.Interface;
using AFBack.Features.Messaging.Repository;
using AFBack.Models.Enums;
using AFBack.Repository;
using ValidationException = AFBack.Infrastructure.Middleware.ValidationException; 

namespace AFBack.Features.Messaging.Validators;

public class SendMessageValidator(
    IMessageRepository messageRepository,
    IUserBlockRepository userBlockRepository,
    IConversationRepository conversationRepository,
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
        if (conversation == null)
        {
            logger.LogError("UserId: {UserId} attempted to access conversation with Id {ConversationId} that does not " +
                            "exist. Either a bug from frontend or malicious attempt",
                senderId, request.ConversationId);
            return Result.Failure($"Conversation with id {request.ConversationId} does not exist", 
                ErrorTypeEnum.NotFound);
        }
        
        
        // Sjekker at vi er participant, har godkjent samtalen og ikke har slettet samtalen
        var userParticipantsResult = ValidateUserParticipants(senderId, conversation);
        if (userParticipantsResult.IsFailure)
            return userParticipantsResult;
        
        
        // sjekker at ParentMessage eksisterer
        if (request.ParentMessageId.HasValue)
        {
            var parentMessageResult = await ValidateParentMessageExists(senderId, request.ParentMessageId.Value);
            if (parentMessageResult.IsFailure)
                return parentMessageResult;
        }


        if (conversation.Type == ConversationType.PendingRequest)
        {
            var oneOnOneResult = await ValidateOneOnOneConversation(senderId, conversation);
            if (oneOnOneResult.IsFailure)
                return oneOnOneResult;

        }

        return Result.Success();

    }
    
    /// <summary>
    /// Henter oss selv som en participant, sjekker at vi er participant, at vi ikke har slettet samtalen og at
    /// vi har godkjent den
    /// </summary>
    /// <param name="conversation"></param>
    /// <param name="senderId"></param>
    private Result ValidateUserParticipants(string senderId, Conversation.Models.Conversation conversation)
    {
        // Henter ut oss selv som participant
        var participant = conversation.Participants
            .FirstOrDefault(p => p.UserId == senderId);

        // Sjekker at vi er en participant i samtalen
        if (participant == null)
        {
            logger.LogError(
                "User {UserId} attempted to send message to conversation {ConversationId} where they are not a " +
                "participant. Either a bug from frontend or malicious attempt",
                senderId, conversation.Id);
            return Result.Failure("You are not a participant of this conversation", ErrorTypeEnum.Forbidden);
        }
        
        // Sjekker at sender ikke har soft slettet/arkivert samtalen 
        if (participant.ConversationArchived)
        {
            logger.LogWarning(
                "User {UserId} attempted to send message to archived/deleted conversation {ConversationId}",
                senderId, conversation.Id);
            return Result.Failure("You cannot send messages to a conversation you have deleted", 
                ErrorTypeEnum.Gone);
        }
        
        // Sender kan kun sende meldinger til samtaler som er akseptert. Samtaler som er pending eller avslått går ikke
        if (participant.Status != ConversationStatus.Accepted)
        {
            logger.LogWarning(
                "User {UserId} attempted to send message to non-accepted conversation {ConversationId}. " +
                "Status: {Status}",
                senderId, conversation.Id, participant.Status);
            return Result.Failure("You must accept the conversation before sending messages", 
                ErrorTypeEnum.Forbidden);
        }

        return Result.Success();
    }

    /// <summary>
    /// Sjekker at ParentMessage eksisterer
    /// </summary>
    /// <param name="userId"></param>
    /// <param name="parentMessageId"></param>
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
    /// Vi validerer dataen gjelder 1-1 samtaler. Henter og valdierer mottaker, sjekker blokkeringer og om mottaker
    /// har godkjent samtalen
    /// </summary>
    /// <param name="conversation"></param>
    /// <param name="userId"></param>
    /// <exception cref="ValidationException"></exception>
    private async Task<Result> ValidateOneOnOneConversation(string userId, Conversation.Models.Conversation conversation)
    {
        // Henter mottakeren i 1-1 samtalen
        var messageReceiver =
            conversation.Participants.FirstOrDefault(p => p.UserId != userId);

        // Sjekker at det finnes en mottaker
        if (messageReceiver == null)
        {
            logger.LogCritical(
                "Data integrity error: No receiver found in 1-1 conversation {ConversationId} for sender {UserId}",
                conversation.Id, userId);
            throw new InvalidOperationException("Conversation data is corrupted. Please contact support.");
        }

        // Sjekker om avsenderen blokkert mottakeren
        if (await userBlockRepository.IsFirstUserBlockedBySecondary(messageReceiver.UserId, userId))
        {
            logger.LogWarning(
                "User {UserId} attempted to send message to blocked user {ReceiverId}",
                userId, messageReceiver.UserId);
            return Result.Failure("You cannot send messages to a user you have blocked.", 
                ErrorTypeEnum.Forbidden);
        }
        
        // Henter fra UserBlocks hvis avsender er blokkert av mottaker
        var senderIsBlocked =
            await userBlockRepository.IsFirstUserBlockedBySecondary(userId, messageReceiver.UserId);

        // Hvis avsender er blokkert av mottaker eller mottaker har slettet samtalen
        if (senderIsBlocked || messageReceiver.ConversationArchived)
        {
            logger.LogWarning(
                "User {UserId} cannot send to user {ReceiverId} in conversation {ConversationId}. " +
                "SenderBlocked: {SenderBlocked}, ReceiverArchived: {ReceiverArchived}",
                userId, messageReceiver.UserId, conversation.Id, senderIsBlocked, messageReceiver.ConversationArchived);

            return Result.Failure(
                "This user has been deleted, is no longer visible," +
                " or you lack the required permission to send messages.", ErrorTypeEnum.Forbidden);
        }
        
        // Sjekker messageLimit hvis samtalen er pending
        // I ValidateUserParticipants så har vi allerede sjekket at bruker (avsender) er akseptert/opprettet samtalen
        // Brukeren (mottaker) kan kun få 5 meldinger hvis de selv er pending/rejected
        if (conversation.Type == ConversationType.PendingRequest && messageReceiver.PendingMessagesReceived >= 5)
        {
            logger.LogWarning(
                "User {UserId} attempted to send message but receiver {ReceiverId} has reached message limit " +
                "({Count}/5)",
                userId, messageReceiver.UserId, messageReceiver.PendingMessagesReceived);
            return Result.Failure("Cannot send more messages until the recipient accepts your request",
                ErrorTypeEnum.Forbidden);
        }

        return Result.Success();
    }
}
