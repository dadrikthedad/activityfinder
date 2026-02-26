using AFBack.Common.DTOs;
using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Features.Blocking.Services;
using AFBack.Features.Broadcast.Services;
using AFBack.Features.Broadcast.Services.Interfaces;
using AFBack.Features.Conversation.DTOs;
using AFBack.Features.Conversation.DTOs.Request;
using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.Conversation.Enums;
using AFBack.Features.Conversation.Extensions;
using AFBack.Features.Conversation.Models;
using AFBack.Features.Conversation.Repository;
using AFBack.Features.Conversation.Validators;
using AFBack.Features.FileHandling.Services;
using AFBack.Features.Friendship.Repository;
using AFBack.Features.Messaging.DTOs.Request;
using AFBack.Features.Messaging.Extensions;
using AFBack.Features.Messaging.Models;
using AFBack.Features.Messaging.Repository;
using AFBack.Features.Messaging.Services;
using AFBack.Infrastructure.Cache;
using Newtonsoft.Json;

namespace AFBack.Features.Conversation.Services;

public class DirectConversationService(
    ILogger<DirectConversationService> logger,
    IConversationRepository conversationRepository,
    IMessageRepository messageRepository,
    IConversationValidator conversationValidator,
    IBlockingService blockingService,
    ISendMessageService sendMessageService,
    IConversationBroadcastService broadcastService,
    ICanSendCache canSendCache,
    IUserSummaryCacheService userSummariesCache,
    IFriendshipRepository friendshipRepository,
    IBlobUrlBuilder blobUrlBuilder) : IDirectConversationService
{
     /// <inheritdoc />
     public async Task<Result<SendMessageToUserResponse>> SendMessageToUserAsync(string userId, 
        SendMessageToUserRequest request)
    {
        logger.LogInformation("User {SenderId} is attempting to send a message to {ReceiverId}", 
            userId, request.ReceiverId);
        
        // ============ VALIDERING ============
        
        // Sjekk om mottaker eksisterer
        var receiverSummary = await userSummariesCache.GetUserSummaryAsync(request.ReceiverId);
        if (receiverSummary == null)
        {
            logger.LogWarning("User {ReceiverId} does not exist", request.ReceiverId);
            return Result<SendMessageToUserResponse>.Failure("User not found", ErrorTypeEnum.NotFound);
        }
        
        // Sjekk om det allerede finnes en samtale
        var existingConversation = await conversationRepository
            .GetConversationBetweenUsersAsync(userId, request.ReceiverId);
        
        // Samtale eksisterer - send melding i eksisterende samtale
        if (existingConversation != null)
            return await SendMessageToExistingConversationAsync(userId, request.ReceiverId, existingConversation, 
                request);
        
        // Sjekk blokkeringer begge veier
        var blockResult = await blockingService.ValidateNoBlockingsAsync(userId, request.ReceiverId);
        if (blockResult.IsFailure)
            return Result<SendMessageToUserResponse>.Failure(blockResult.Error, blockResult.ErrorType);
        
        // Sjekk om de er venner for å bestemme samtale-type
        var areFriends = await friendshipRepository.FriendshipExistsAsync(userId, request.ReceiverId);
        
        // ============ DATABASE: Opprett samtalen med nye entiteter ============
        
        //  Opprett ny samtale-entitet
        var newConversation = new Models.Conversation
        {
            // Askeptert hvis brukerne er venner, pending hvis ikke
            Type = areFriends ? ConversationType.DirectChat : ConversationType.PendingRequest
        };
        
        // Oppretter participants for avsender og mottaker
        var userParticipant = new ConversationParticipant
        {
            UserId = userId,
            Status = ConversationStatus.Accepted,
            Role = ParticipantRole.PendingSender,
            JoinedAt = DateTime.UtcNow,
        };
        
        var receiverParticipant = new ConversationParticipant
        {
            UserId = request.ReceiverId,
            Status = areFriends ? ConversationStatus.Accepted : ConversationStatus.Pending, // Venner = accepted
            Role = ParticipantRole.PendingRecipient,
            InvitedAt = DateTime.UtcNow,
        };
        
        // Oppretter og lager meldingen
        var message = new Message
        {
            SenderId = userId,
            EncryptedText = request.EncryptedText,
            KeyInfo = JsonConvert.SerializeObject(request.KeyInfo),
            IV = request.IV,
            Version = request.Version
        };
        
        // Lagrer entitene i databasen
        var createdConversation = 
            await conversationRepository.CreateConversationWithParticipantsAsync(newConversation, 
                [userParticipant, receiverParticipant], message);
        
        // Legger til CanSend igjen hvis begge brukerne var venner
        if (createdConversation.Type == ConversationType.DirectChat)
        {
            await canSendCache.OnCanSendAddedAsync(userId, createdConversation.Id);
            await canSendCache.OnCanSendAddedAsync(request.ReceiverId, createdConversation.Id);
        }
        
        // Hent den opprettede samtalen som ConversationDto, deretter valider at samtalen eksisterer
        var conversationDto = await conversationRepository.GetConversationDtoAsync(createdConversation.Id);
        if (conversationDto == null)
        {
            logger.LogCritical("Created conversation {ConversationId} not found after creation",
                createdConversation.Id);
            return Result<SendMessageToUserResponse>.Failure(
                "Failed to retrieve created conversation", ErrorTypeEnum.InternalServerError);
        }

        var messageDto = await messageRepository.GetMessageDtoAsync(message.Id);
        if (messageDto == null)
        {
            logger.LogCritical("Created message {MessageId} not found after creation",
                message.Id);
            return Result<SendMessageToUserResponse>.Failure(
                "Failed to retrieve created message", ErrorTypeEnum.InternalServerError);
        }
        
        // Hent users for cache
        var senderSummary = await userSummariesCache.GetUserSummaryAsync(userId);
        var conversationUsers = new Dictionary<string, UserSummaryDto>
        {
            [userId] = senderSummary!,
            [request.ReceiverId] = receiverSummary
        };

        var sendMessageToUserResponse = new SendMessageToUserResponse
        {
            ConversationId = createdConversation.Id,
            IsNewConversation = true,
            Conversation = conversationDto.ToResponse(conversationUsers),
            Message = messageDto.ToResponse(conversationUsers, blobUrlBuilder)
        };
        
        logger.LogInformation(
            "User {SenderId} successfully created {Type} conversation {ConversationId} with {ReceiverId}",
            userId, conversationDto.Type, createdConversation.Id, request.ReceiverId);
        
        // ============ POST-COMMIT: Broadcast ============
        
        if (createdConversation.Type == ConversationType.PendingRequest)
        {
            await broadcastService.BroadcastNewPendingRequestAsync(
                userId, request.ReceiverId, sendMessageToUserResponse);
        }
        else
        {
            await broadcastService.BroadcastNewDirectConversationAsync(
                userId, request.ReceiverId, sendMessageToUserResponse);
        }
        
        return Result<SendMessageToUserResponse>.Success(sendMessageToUserResponse);
    }
    
    /// <summary>
    /// Sender en melding til en eksisterende samtale. Hvis avsender har mottatt en pending forespørsel,
    /// aksepteres samtalen automatisk før meldingen sendes.
    /// </summary>
    /// <param name="userId">Avsender</param>
    /// <param name="receiverId">Mottaker</param>
    /// <param name="conversation">Eksisterende samtale mellom brukerne</param>
    /// <param name="request">Meldingsdata med kryptert innhold</param>
    /// <returns>SendMessageToUserResponse med samtale, melding og wasAccepted-flagg</returns>
    private async Task<Result<SendMessageToUserResponse>> SendMessageToExistingConversationAsync(
    string userId,
    string receiverId,
    ConversationDto conversation,
    SendMessageToUserRequest request)
    {
        var wasAccepted = false;
        
        // Sjekker om avsender er den som har mottatt en pending forespørsel
        var isSenderPending = conversation.Type == ConversationType.PendingRequest 
                              && conversation.Participants
                                  .Any(cp => cp.UserId == userId 
                                             && cp.Status == ConversationStatus.Pending);
        
        if (isSenderPending)
        {
            // Auto-accept ved å sende melding
            logger.LogInformation(
                "User {UserId} is accepting pending conversation {ConversationId} by sending a message",
                userId, conversation.Id);
            
            var acceptResult = await AcceptPendingConversationRequestAsync(userId, conversation.Id);
            
            if (acceptResult.IsFailure)
                return Result<SendMessageToUserResponse>.Failure(acceptResult.Error, acceptResult.ErrorType);
            
            wasAccepted = true;
            
            // Hent oppdatert samtale etter accept
            conversation = (await conversationRepository.GetConversationBetweenUsersAsync(userId, receiverId))!;
        }
        
        // Opprett og send melding
        var messageRequest = new MessageRequest
        {
            ConversationId = conversation.Id,
            EncryptedText = request.EncryptedText,
            KeyInfo = request.KeyInfo,
            IV = request.IV,
            Version = request.Version,
            EncryptedAttachments = null
        };
        
        var messageResult = await sendMessageService.SendMessageAsync(messageRequest, userId);
        if (messageResult.IsFailure)
        {
            logger.LogCritical(
                "Message by User {SenderId} failed to send to User {ReceiverId} in conversation {ConversationId}",
                userId, receiverId, conversation.Id);
            return Result<SendMessageToUserResponse>.Failure(messageResult.Error, messageResult.ErrorType);
        }
        
        // Hent full messageDTO for response
        var messageDto = await messageRepository.GetMessageDtoAsync(messageResult.Value!.MessageId);
        if (messageDto == null)
        {
            logger.LogCritical("Sent message {MessageId} not found after sending", messageResult.Value.MessageId);
            return Result<SendMessageToUserResponse>.Failure(
                "Failed to retrieve sent message", ErrorTypeEnum.InternalServerError);
        }
        
        // Hent brukere fra cache
        var userIds = conversation.Participants.Select(p => p.UserId).Distinct().ToList();
        var users = await userSummariesCache.GetUserSummariesAsync(userIds);
        
        return Result<SendMessageToUserResponse>.Success(new SendMessageToUserResponse
        {
            ConversationId = conversation.Id,
            WasAccepted = wasAccepted,
            IsNewConversation = false,
            Conversation = conversation.ToResponse(users),
            Message = messageDto.ToResponse(users, blobUrlBuilder)
        });
    }
    
    
    /// <inheritdoc />
    public async Task<Result<ConversationResponse>> AcceptPendingConversationRequestAsync(string userId, 
        int conversationId)
    {
        logger.LogInformation("User {UserId} is attempting to accept pending conversation {ConversationId}", 
            userId, conversationId);
        
        // ============ VALIDERING ============
        
        var conversation = await conversationRepository.GetConversationWithTrackingAsync(conversationId);
        
        var validationResult = conversationValidator.ValidatePendingRequestAction(userId, conversationId, conversation);
        if (validationResult.IsFailure)
            return Result<ConversationResponse>.Failure(validationResult.Error, validationResult.ErrorType);
        
        var userParticipant = validationResult.Value!;
        
        // Finn den andre participanten (senderen)
        var senderParticipant = conversation!.Participants.FirstOrDefault(p => p.UserId != userId);
        
        if (senderParticipant == null)
        {
            logger.LogCritical("Conversation {ConversationId} has no sender participant", conversationId);
            return Result<ConversationResponse>.Failure("Server error. Try again later or contact support", 
                ErrorTypeEnum.InternalServerError);
        }
        
        // ============ DATABASE: Oppdater database ============
        
        // Oppdater Conversation
        conversation.Type = ConversationType.DirectChat;
        
        // Oppdater begge participants
        userParticipant.Status = ConversationStatus.Accepted;
        userParticipant.JoinedAt = DateTime.UtcNow;
        
        senderParticipant.Status = ConversationStatus.Accepted;
        
        // Lagre endringer
        await conversationRepository.SaveChangesAsync();
        
        logger.LogInformation("User {UserId} successfully accepted conversation {ConversationId}", 
            userId, conversationId);
        
        // ============ POST-COMMIT: Cache ============
        
        // Legg begge brukere inn i CanSend cache
       
        await canSendCache.OnCanSendAddedAsync(userId, conversationId);
        await canSendCache.OnCanSendAddedAsync(senderParticipant.UserId, conversationId);
        
        
        // ============ HENT DATA FOR RESPONSE ============
        
        var conversationDto = await conversationRepository.GetConversationDtoAsync(conversationId);
        if (conversationDto == null)
        {
            logger.LogCritical("Created conversation {ConversationId} not found after creation",
                conversationId);
            return Result<ConversationResponse>.Failure(
                "Failed to retrieve updated conversation", ErrorTypeEnum.InternalServerError);
        }
        
        // Hent users for cache
        var conversationUserIds = new List<string> { userId, senderParticipant.UserId };
        var conversationUsers = 
            await userSummariesCache.GetUserSummariesAsync(conversationUserIds);
        
        // Bygg Response
        var conversationResponse = conversationDto.ToResponse(conversationUsers);
        
        // ============ POST-COMMIT: Broadcast ============
        
        // Hent UserSummaryDto for brukeren som aksepterte (for notification)
        var acceptingUserSummary = conversationUsers.GetValueOrDefault(userId);
        if (acceptingUserSummary == null)
            logger.LogWarning("User {UserId} not found in cache for group {ConversationId}", userId, conversationId);
        
        // Systemmelding - nøytral
        var systemMessage = $"{acceptingUserSummary!.FullName} has accepted the conversation request";

        // Notification summary - personlig til mottaker
        var notificationSummary = $"{acceptingUserSummary.FullName} has accepted your conversation request";
        
        // Send systemmelding
        try
        {
            await sendMessageService.SendSystemMessageAsync(conversationId, systemMessage);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send system message for accepted conversation {ConversationId}", 
                conversationId);
        }
        
        
        await broadcastService.BroadcastPendingRequestAcceptedAsync(
            userId, senderParticipant.UserId, conversationResponse, notificationSummary,acceptingUserSummary );
        
        return Result<ConversationResponse>.Success(conversationResponse);
    }
    
    /// <inheritdoc />
    public async Task<Result> RejectPendingConversationRequestAsync(string userId, int conversationId)
    {
        logger.LogInformation("User {UserId} is attempting to reject pending conversation {ConversationId}", 
            userId, conversationId);
        
        // ============ VALIDERING ============
        
        var conversation = await conversationRepository.GetConversationWithTrackingAsync(conversationId);
        
        var validationResult = conversationValidator.ValidatePendingRequestAction(userId, conversationId, conversation);
        if (validationResult.IsFailure)
            return Result.Failure(validationResult.Error, validationResult.ErrorType);
        
        var userParticipant = validationResult.Value!;
        
        // ============ DATABASE: Oppdater database ============
        
        // Oppdater kun mottakerens status til Rejected
        userParticipant.Status = ConversationStatus.Rejected;
        
        // Lagre endringer
        await conversationRepository.SaveChangesAsync();
        
        logger.LogInformation("User {UserId} successfully rejected conversation {ConversationId}", 
            userId, conversationId);
        
        // ============ POST-COMMIT: Broadcast ============
        
        await broadcastService.BroadcastPendingRequestRejectedAsync(userId, conversationId);
        
        return Result.Success();
    }
}
