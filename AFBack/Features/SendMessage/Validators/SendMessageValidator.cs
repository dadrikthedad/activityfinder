using AFBack.Features.Cache.Interface;
using AFBack.Features.SendMessage.DTOs;
using AFBack.Features.SendMessage.Interface;
using AFBack.Infrastructure.Validator;
using AFBack.Models;
using AFBack.Interface.Repository;
using ValidationException = AFBack.Infrastructure.Middleware.ValidationException; 

namespace AFBack.Features.SendMessage.Validators;

public class SendMessageValidator(
    IMessageRepository messageRepository,
    IUserBlockRepository userBlockRepository,
    IConversationRepository conversationRepository,
    ILogger<SendMessageValidator> logger,
    IUserCache userCache) : BaseValidator<SendMessageValidator>(logger), ISendMessageValidator
{
    
    /// <summary>
    /// Hovedvalideringsmetoden som kaller de andre valideringene. Brukes i SendMessageAsync. Retunrer ingenting, men
    /// kaster exception hvis noe er galt
    /// </summary>
    /// <param name="request"></param>
    /// <param name="userId"></param>
    /// <returns></returns>
    public async Task ValidateSendMessageAsync(SendMessageRequest request, int userId)
    {
        // Sjekker om bruken eksisterer
        ValidateAndThrow(!await userCache.UserExistsAsync(userId), 
            "SendMessageValidator: Unauthorized access attempt! User {UserId} does not exists", "User not found", userId);

        // Henter samtalen eller null hvis ikke
        var conversation = await conversationRepository.GetConversation(request.ConversationId);
        
        // Sjekker at samtalen eksisterer
        ValidateAndThrow(conversation == null, "SendMessageValidator: Conversation {ConversationId} does not exist.",
            $"Conversation {request.ConversationId} does not exist", request.ConversationId);
        
        // Sjekker at vi er participant, har godkjent samtalen og ikke har slettet samtalen
        ValidateUserParticipants(conversation!, userId);
        
        // sjekker at ParentMessage eksisterer
        if (request.ParentMessageId.HasValue)
            await ValidateParentMessageExists(request.ParentMessageId.Value);

        if (!conversation!.IsGroup)
            await ValidateOneOnOneConversation(conversation, userId);
    }
    
    /// <summary>
    /// Henter oss selv som en participant, sjekker at vi er participant, at vi ikke har slettet samtalen og at
    /// vi har godkjent den
    /// </summary>
    /// <param name="conversation"></param>
    /// <param name="userId"></param>
    public void ValidateUserParticipants(Conversation conversation, int userId)
    {
        
        // Henter ut oss selv som participant
        var participant = conversation.Participants.FirstOrDefault(participants => participants.UserId == userId);

        // Sjekker at vi er en participant
        ValidateAndThrow(participant == null,
            "SendMessageValidator: User {UserId} is not an participant in conversation {ConversationId}.",
            "You are not authorized to send messages in this conversation.", userId, conversation.Id);

        // Sjekker at bruker ikke har slettet samtalen
        ValidateAndThrow(participant!.HasDeleted, "SendMessageValidator: User {UserId} has deleted conversation {ConversationId}.",
            "Cannot send messages to deleted conversation.", userId, conversation.Id);
        
        // Sjekker at vi har godkjent samtalen
        ValidateAndThrow(
            participant.ConversationStatus != ConversationStatus.Approved &&
            participant.ConversationStatus != ConversationStatus.Creator,
            "SendMessageValidator: User {UserId} cannot send messages in conversation {ConversationId}. Status is {Status}.",
            "You must approve the conversation to send messages.",
            userId, conversation.Id, participant.ConversationStatus!);
        
    }
    
    /// <summary>
    /// Sjekker at ParentMessage eksisterer
    /// </summary>
    /// <param name="parentMessageId"></param>
    public async Task ValidateParentMessageExists(int parentMessageId)
    {
        // Sjekk i databasen om å finne denne messageIden
        var parentExists = await messageRepository.MessageExists(parentMessageId);
        
        ValidateAndThrow(!parentExists, "SendMessageValidator: ParentMessage {ParentMessageId} not found.",
            "Parent Message not found",
            parentMessageId);
    }
    
    /// <summary>
    /// Vi validerer dataen gjelder 1-1 samtaler. Henter og valdierer mottaker, sjekker blokkeringer og om mottaker
    /// har godkjent samtalen
    /// </summary>
    /// <param name="conversation"></param>
    /// <param name="userId"></param>
    /// <exception cref="ValidationException"></exception>
    public async Task ValidateOneOnOneConversation(Conversation conversation, int userId)
    {
        // Henter mottakeren i 1-1 samtalen
        var messageReceiver =
            conversation.Participants.FirstOrDefault(p => p.UserId != userId);

        // Sjekker at det finnes en mottaker
        ValidateAndThrow(messageReceiver == null, "SendMessageValidator: There is no other userId in conversation {ConversationId}",
            "The userId has deleted their userId or the conversation is bugged", conversation.Id);

        // Henter fra UserBlocks hvis avsender har blokkert mottaker
        var senderHasBlockedReceiver =
            await userBlockRepository.IsFirstUserBlockedBySecondary(messageReceiver!.UserId, userId);

        // Sjekker om avsender har blokkert brukeren
        ValidateAndThrow(senderHasBlockedReceiver,
            "SendMessageValidator: User {UserId} has blocked userId {ReceiverId} therefor cannot send message",
            "You cannot send messages to a userId you have blocked.", userId, messageReceiver.UserId);

        // Henter fra UserBlocks hvis avsender er blokkert av mottaker
        var senderIsBlocked =
            await userBlockRepository.IsFirstUserBlockedBySecondary(userId, messageReceiver.UserId);

        // Hvis avsender er blokkert av mottaker eller mottaker har slettet samtalen
        if (senderIsBlocked || messageReceiver.HasDeleted)
        {
            if (senderIsBlocked)
                _logger.LogError("SendMessageValidator: User {UserId} is blocked by userId {ReceiverId}", userId, messageReceiver.UserId);
            else
                _logger.LogError(
                    "SendMessageValidator: User {ReceiverId} has deleted conversation {ConversationId} therefor cannot receive message",
                    messageReceiver.Id, conversation.Id);

            throw new ValidationException(
                "This userId has been deleted or is no longer visible, or you lack the required permission to send messages.");
        }
                
        // Vi kan ikke sende melding til en bruker som ikke har akseptert samtalen
        ValidateAndThrow(messageReceiver.ConversationStatus != ConversationStatus.Approved,
            "SendMessageValidator: {ReceiverId} has not accepted Message Request for conversation {ConversationId}",
            "The userId has not accepted your request.", messageReceiver.UserId, conversation.Id);
    }
}
