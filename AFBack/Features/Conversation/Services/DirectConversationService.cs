using AFBack.Cache;
using AFBack.Common;
using AFBack.Common.Results;
using AFBack.Features.Block;
using AFBack.Features.Conversation.DTOs.Request;
using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.Conversation.Extensions;
using AFBack.Features.Conversation.Models;
using AFBack.Features.Conversation.Repository;
using AFBack.Features.Conversation.Validators;
using AFBack.Features.Friendship.Repository;
using AFBack.Features.MessageNotification.Service;
using AFBack.Features.Messaging.DTOs.Request;
using AFBack.Features.Messaging.Extensions;
using AFBack.Features.Messaging.Interface;
using AFBack.Features.Messaging.Models;
using AFBack.Features.Messaging.Repository;
using AFBack.Features.SyncEvents.Enums;
using AFBack.Features.SyncEvents.Services;
using AFBack.Hubs;
using AFBack.Interface.Repository;
using AFBack.Models.Enums;
using Microsoft.AspNetCore.SignalR;
using Newtonsoft.Json;

namespace AFBack.Features.Conversation.Services;

public class DirectConversationService(
    ILogger<DirectConversationService> logger,
    IConversationRepository conversationRepository,
    IMessageRepository messageRepository,
    IUserRepository userRepository,
    IConversationValidator conversationValidator,
    IBlockService blockService,
    ISendMessageService sendMessageService,
    ISyncService syncService,
    ISendMessageCache sendMessageCache,
    IUserSummaryCacheService userSummariesCache,
    IHubContext<UserHub> hubContext,
    IFriendshipRepository friendshipRepository,
    IMessageNotificationService messageNotificationService,
    ISendMessageService messageService) : IDirectConversationService
{
     // Sjekk interface for summary
    public async Task<Result<SendMessageToUserResponse>> SendMessageToUserAsync(string userId, 
        SendMessageToUserRequest request)
    {
        logger.LogInformation("User {SenderId} is attempting to send a message to {ReceiverId}", 
            userId, request.ReceiverId);
        
        // Sjekk om mottaker eksisterer
        var receiverExists = await userRepository.UserExistsAsync(request.ReceiverId);
        if (!receiverExists)
        {
            logger.LogWarning("User {ReceiverId} does not exist", request.ReceiverId);
            return Result<SendMessageToUserResponse>.Failure(
                "User not found", ErrorTypeEnum.NotFound);
        }
        
        // Sjekk om det allerede finnes en samtale
        var existingConversation = await conversationRepository
            .GetConversationBetweenUsersAsync(userId, request.ReceiverId);
        
        // Samtale eksisterer - send melding i eksisterende samtale
        if (existingConversation != null)
        {
            
            // Sjekker om avsender er den som har mottat en pending forespørsel
            var isSenderPending = existingConversation.Type == ConversationType.PendingRequest 
                                  && existingConversation.Participants
                                      .Any(cp => cp.UserId == userId 
                                                 && cp.Status == ConversationStatus.Pending);
            // Variabel hvis brukeren er pending og godkjenner samtalen
            var wasAccepted = false; 
            
            if (isSenderPending)
            {
                // Auto-accept ved å sende melding
                logger.LogInformation(
                    "User {UserId} is accepting pending conversation {ConversationId} by sending a message",
                    userId, existingConversation.Id);
                
                
                // Bruker dedikert accept-metode for konsistens og fullstendig flyt
                // (inkluderer cache-oppdatering, sync events, notifications, etc.)
                var acceptResult = await AcceptPendingConversationRequestAsync(
                    userId, existingConversation.Id);
                
                if (acceptResult.IsFailure)
                {
                    return Result<SendMessageToUserResponse>.Failure(
                        acceptResult.Error, acceptResult.ErrorType);
                }
                
                wasAccepted = true; 
                
                existingConversation = await conversationRepository
                    .GetConversationBetweenUsersAsync(userId, request.ReceiverId);
            }
                
            
            // Opprett en MessageRequest
            var messageRequest = new MessageRequest
            {
                ConversationId = existingConversation!.Id,
                EncryptedText = request.EncryptedText,
                KeyInfo = request.KeyInfo,
                IV = request.IV,
                Version = request.Version,
                EncryptedAttachments = null
            };
            
            // Sender en melding som vanlig hot path og verfiserer at den ble sendt
            var messageResult = await sendMessageService.SendMessageAsync(messageRequest, userId);
            if (messageResult.IsFailure)
            {
                logger.LogCritical("Message by User {SenderId} failed to send to User {ReceiverId} in conversation " +
                                   "{ConversationId}",
                    userId, request.ReceiverId, existingConversation.Id);
                return Result<SendMessageToUserResponse>.Failure(
                    messageResult.Error, messageResult.ErrorType);
            }
            
            // Hent full messageDTO for SendMessageToUserResponse
            var messageDtoFromHotPath = await messageRepository.GetMessageDtoAsync(messageResult.Value!.MessageId);
            if (messageDtoFromHotPath == null)
            {
                logger.LogCritical("Sent message {MessageId} not found after sending",
                    messageResult.Value.MessageId);
                return Result<SendMessageToUserResponse>.Failure(
                    "Failed to retrieve sent message", ErrorTypeEnum.InternalServerError);
            }
            
            // Henter brukere for cache
            var userIds = existingConversation.Participants
                .Select(p => p.UserId)
                .Distinct()
                .ToList();
        
            // Henter cachede brukere
            var users = await userSummariesCache.GetUserSummariesAsync(userIds);
            
            return Result<SendMessageToUserResponse>.Success(new SendMessageToUserResponse
            {
                ConversationId = existingConversation.Id,
                WasAccepted = wasAccepted,
                IsNewConversation = false,
                Conversation = existingConversation.ToResponse(users),
                Message = messageDtoFromHotPath.ToResponse(users[userId])
            });
        }
        
        // Sjekk blokkeringer begge veier
        var blockResult = await blockService.ValidateNoBlockingsAsync(userId, request.ReceiverId);
        if (blockResult.IsFailure)
            return Result<SendMessageToUserResponse>.Failure(blockResult.Error, blockResult.ErrorType);
        
        // Sjekk om de er venner for å bestemme samtale-type
        var areFriends = await friendshipRepository.FriendshipExistsAsync(userId, request.ReceiverId);
        
        ////////// Opprett samtalen //////////
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
            try
            {
                await sendMessageCache.OnCanSendAddedAsync(userId, createdConversation.Id);
                await sendMessageCache.OnCanSendAddedAsync(request.ReceiverId, createdConversation.Id);
            }
            catch (Exception ex)
            { 
                logger.LogError(ex, "Error during adding to CanSend. " +
                                    "User: {UserId}, Receiver: {ReceiverId}, Conversations: {ConversationId}", 
                    userId, request.ReceiverId, createdConversation.Id);
            }
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
        var conversationUserIds = new List<string> { userId, request.ReceiverId };
        var conversationUsers = 
            await userSummariesCache.GetUserSummariesAsync(conversationUserIds);

        var sendMessageToUserResponse = new SendMessageToUserResponse
        {
            ConversationId = createdConversation.Id,
            IsNewConversation = true,
            Conversation = conversationDto.ToResponse(conversationUsers),
            Message = messageDto.ToResponse(conversationUsers[userId])
        };
        
        logger.LogInformation(
            "User {SenderId} successfully created {Type} conversation {ConversationId} with {ReceiverId}",
            userId, conversationDto.Type, createdConversation.Id, request.ReceiverId);
        
        // Hvis brukeren ikke var venner så oppretter vi en Pending Conversatiuon Request, eller en direkte samtale
        // Sender SignalR, lagrer Notifcaiton og SyncEvent deretter
        if (createdConversation.Type == ConversationType.PendingRequest)
        {
            // Mottaker får pending conversation notification
            await hubContext.Clients.User(request.ReceiverId)
                .SendAsync("IncomingPendingRequest", sendMessageToUserResponse);
            
            await messageNotificationService.CreatePendingConversationNotificationAsync(
                request.ReceiverId,
                userId,
                conversationResponse: conversationDto.ToResponse(conversationUsers)
            );
            
            // SyncEvent for SENDER
            await syncService.CreateSyncEventsAsync(
                [userId],
                SyncEventType.ConversationCreated, 
                sendMessageToUserResponse);
            
            // SyncEvent for MOTTAKER
            await syncService.CreateSyncEventsAsync(
                [request.ReceiverId],
                SyncEventType.PendingConversationCreated,
                sendMessageToUserResponse);
        }
        else
        {
            // Mottaker får ny samtale notification
            await hubContext.Clients.User(request.ReceiverId)
                .SendAsync("IncomingDirectConversation", sendMessageToUserResponse);
            
            await messageNotificationService.CreateNewMessageNotificationAsync(
                request.ReceiverId,
                userId,
                conversationResponse: conversationDto.ToResponse(conversationUsers),
                messageResponse: messageDto.ToResponse(conversationUsers[userId])
            );
            
            // SyncEvent for SENDER
            await syncService.CreateSyncEventsAsync(
                [userId],
                SyncEventType.ConversationCreated,
                sendMessageToUserResponse);
            
            // SyncEvent for MOTTAKER
            await syncService.CreateSyncEventsAsync(
                [request.ReceiverId],
                SyncEventType.ConversationCreated,
                sendMessageToUserResponse);
        }
        
        return Result<SendMessageToUserResponse>.Success(sendMessageToUserResponse);
    }
    
    
    // Sjekk interface for summary
    public async Task<Result<ConversationResponse>> AcceptPendingConversationRequestAsync(string userId, 
        int conversationId)
    {
        logger.LogInformation("User {UserId} is attempting to accept pending conversation {ConversationId}", 
            userId, conversationId);
        
        // ============ VALIDERING ============
        
        var conversation = await conversationRepository.GetConversationWithTrackingAsync(conversationId);
        
        // Sjekker at samtalen eksisterer
        var conversationResult = conversationValidator.ValidateConversationExists(userId, conversationId, conversation);
        if (conversationResult.IsFailure)
            return Result<ConversationResponse>.Failure(conversationResult.Error, conversationResult.ErrorType);
        
        // Validerer at det er en pending request
        var pendingRequestResult = conversationValidator.ValidateIsPendingRequest(userId, conversation!);
        if (pendingRequestResult.IsFailure)
            return Result<ConversationResponse>.Failure(pendingRequestResult.Error, pendingRequestResult.ErrorType);
        
        // Validerer at brukeren er medlem av samtalen
        var participantResult = conversationValidator.ValidateParticipant(userId, conversation!);
        if (participantResult.IsFailure)
            return Result<ConversationResponse>.Failure(participantResult.Error, participantResult.ErrorType);
        
        var userParticipant = participantResult.Value!;
        
        // Sjekk at brukeren er mottakeren (PendingRecipient)
        var recipientResult = conversationValidator.ValidateIsPendingRecipient(userParticipant);
        if (recipientResult.IsFailure)
            return Result<ConversationResponse>.Failure(
                "You cannot accept a conversation you initiated", recipientResult.ErrorType);
        
        // Sjekker at brukeren har pending status (ikke allerede akseptert)
        var pendingResult = conversationValidator.ValidateParticipantPending(userParticipant);
        if (pendingResult.IsFailure)
            return Result<ConversationResponse>.Failure(
                "Conversation has already been accepted", pendingResult.ErrorType);
        
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
        
        // ============ POST-COMMIT: Cache, SignalR, Notifications ============
        
        // Legg begge brukere inn i CanSend cache
        try
        {
            await sendMessageCache.OnCanSendAddedAsync(userId, conversationId);
            await sendMessageCache.OnCanSendAddedAsync(senderParticipant.UserId, conversationId);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to add users to CanSend cache for conversation {ConversationId}", 
                conversationId);
        }
        
        // Send systemmelding
        try
        {
            await messageService.SendSystemMessageAsync(
                conversationId, 
                "Conversation accepted");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send system message for accepted conversation {ConversationId}", 
                conversationId);
        }
        
        // Henter ConversationDto for SyncEvent
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

        var conversationResponse = conversationDto.ToResponse(conversationUsers);
        
        // Opprett SyncEvent for begge brukere
        try
        {
            // For brukeren som godkjente (mottaker)
            await syncService.CreateSyncEventsAsync(
                [userId],
                SyncEventType.ConversationAccepted,
                conversationResponse);

            // For brukeren som sendte requesten (avsender)
            await syncService.CreateSyncEventsAsync(
                [senderParticipant.UserId],
                SyncEventType.ConversationRequestAccepted,
                conversationResponse);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create sync events for accepted conversation {ConversationId}", 
                conversationId);
        }
        
        // Send SignalR til mottaker (sender av requesten) sine andre enheter
        try
        {
            await hubContext.Clients.User(senderParticipant.UserId)
                .SendAsync("ConversationAccepted", new { conversationId });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send SignalR for accepted conversation {ConversationId}", 
                conversationId);
        }
        
        // Opprett notificaiton for brukern som har sendt requesten
        try
        {
            await messageNotificationService.CreateConversationAcceptedNotificationAsync(
                senderParticipant.UserId, userId, conversationResponse);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create notification for accepted conversation {ConversationId}", 
                conversationId);
        }
        
        return Result<ConversationResponse>.Success(conversationResponse);
    }
    
    // Sjekk interface for summary
    public async Task<Result> RejectPendingConversationRequestAsync(string userId, int conversationId)
    {
        logger.LogInformation("User {UserId} is attempting to reject pending conversation {ConversationId}", 
            userId, conversationId);
        
        // ============ VALIDERING ============
        
        var conversation = await conversationRepository.GetConversationWithTrackingAsync(conversationId);
        
        // Sjekker at samtalen eksisterer
        var conversationResult = conversationValidator.ValidateConversationExists(userId, conversationId, conversation);
        if (conversationResult.IsFailure)
            return Result.Failure(conversationResult.Error, conversationResult.ErrorType);
        
        // Validerer at det er en pending request
        var pendingRequestResult = conversationValidator.ValidateIsPendingRequest(userId, conversation!);
        if (pendingRequestResult.IsFailure)
            return Result.Failure(pendingRequestResult.Error, pendingRequestResult.ErrorType);
        
        // Validerer at brukeren er medlem av samtalen
        var participantResult = conversationValidator.ValidateParticipant(userId, conversation!);
        if (participantResult.IsFailure)
            return Result.Failure(participantResult.Error, participantResult.ErrorType);
        
        var userParticipant = participantResult.Value!;
        
        // Sjekk at brukeren er mottakeren (PendingRecipient)
        var recipientResult = conversationValidator.ValidateIsPendingRecipient(userParticipant);
        if (recipientResult.IsFailure)
            return Result.Failure(
                "You cannot reject a conversation you initiated", recipientResult.ErrorType);
        
        // Sjekker at brukeren har pending status (ikke allerede akseptert)
        var pendingResult = conversationValidator.ValidateParticipantPending(userParticipant);
        if (pendingResult.IsFailure)
            return Result.Failure(
                "Conversation has already been accepted", pendingResult.ErrorType);
        
        // ============ DATABASE: Oppdater database ============
        
        // Oppdater kun mottakerens status til Rejected
        userParticipant.Status = ConversationStatus.Rejected;
        
        // Lagre endringer
        await conversationRepository.SaveChangesAsync();
        
        logger.LogInformation("User {UserId} successfully rejected conversation {ConversationId}", 
            userId, conversationId);
        
        // ============ POST-COMMIT: Sync til brukerens andre enheter ============
        
        // Opprett SyncEvent kun for brukeren som avslår (sender skal ikke vite)
        try
        {
            await syncService.CreateSyncEventsAsync(
                [userId],
                SyncEventType.ConversationRejected,
                conversationId);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create sync event for rejected conversation {ConversationId}", 
                conversationId);
        }
        
        return Result.Success();
    }
}
