using AFBack.Cache;
using AFBack.Common;
using AFBack.Common.DTOs;
using AFBack.Common.Results;
using AFBack.Features.Conversation.DTOs;
using AFBack.Features.Conversation.DTOs.Request;
using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.Conversation.Extensions;
using AFBack.Features.Conversation.Models;
using AFBack.Features.Conversation.Repository;
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
using AFBack.Repository;
using Microsoft.AspNetCore.SignalR;
using Newtonsoft.Json;


namespace AFBack.Features.Conversation.Services;

public class NewConversationService(
    ILogger<NewConversationService> logger,
    IConversationRepository conversationRepository,
    ISyncService syncService,
    ISendMessageCache msgCache,
    IUserRepository userRepository,
    IUserSummaryCacheService userSummariesCache,
    ISendMessageService messageService,
    IUserBlockRepository userBlockRepository,
    IFriendshipRepository friendshipRepository,
    IMessageRepository messageRepository,
    IHubContext<UserHub> hubContext,
    IMessageNotificationService messageNotificationService) : INewConversationService
{
    
    // SJekk interface for summary
    public async Task<Result<ConversationResponse>> GetConversationAsync(string userId, int conversationId)
    {
        logger.LogInformation("Getting conversation {ConversationId} for User {UserId}", 
            conversationId, userId);
        
        // Henter samtalen som en ConversationDto
        var conversationDto = await conversationRepository.GetConversationDtoAsync(conversationId);
        
        // Sjekker at det var en samtale med denne ID-en
        if (conversationDto == null)
        {
            logger.LogError("User {UserId} tried to get a conversation that does not exists. ConversationId " +
                            "{ConversationId}", userId, conversationId);
            return Result<ConversationResponse>.Failure("No conversation found", ErrorTypeEnum.NotFound);
        }
        
        // Henter alle brukerne
        var userIds = conversationDto.Participants
            .Select(p => p.UserId)
            .Distinct()
            .ToList();
        
        // Sjekker at brukeren er participant av samtalen
        if (!userIds.Contains(userId))
        {
            logger.LogWarning("User {UserId} tried to get a conversation without permission. ConversationId " +
                              "{ConversationId}", userId, conversationId);

            return Result<ConversationResponse>.Failure("No conversation found", ErrorTypeEnum.Forbidden);
        }
        
        // Henter UserSummaries
        var users = await userSummariesCache.GetUserSummariesAsync(userIds);
        
        // Mapper og returnerer en response
        return Result<ConversationResponse>.Success(conversationDto.ToResponse(users));
    }
    
    
    
    public async Task<Result<ConversationsResponse>> GetActiveConversationsAsync(
        string userId, PaginationRequest request)
    {
        logger.LogInformation("Getting active conversations for User {UserId}", userId);
        
        return await GetConversationsInternalAsync(
            userId,
            request,
            conversationRepository.GetActiveConversationsCountAsync,
            conversationRepository.GetActiveConversationsAsync);
    }
    
    
    public async Task<Result<ConversationsResponse>> GetPendingConversationsAsync(
        string userId, PaginationRequest request)
    {
        logger.LogInformation("Getting pending conversations for User {UserId}", userId);
        
        return await GetConversationsInternalAsync(
            userId,
            request,
            conversationRepository.GetPendingConversationsCountAsync,
            conversationRepository.GetPendingConversationsAsync);
    }
    
    
    public async Task<Result<ConversationsResponse>> GetArchivedConversationsAsync(
        string userId, PaginationRequest request)
    {
        logger.LogInformation("Getting archived conversations for User {UserId}", userId);
        
        return await GetConversationsInternalAsync(
            userId,
            request,
            conversationRepository.GetArchivedConversationsCountAsync,
            conversationRepository.GetArchivedConversationsAsync);
    }
    
    
    public async Task<Result<ConversationsResponse>> GetRejectedConversationsAsync(
        string userId, PaginationRequest request)
    {
        logger.LogInformation("Getting rejected conversations for User {UserId}", userId);
        
        return await GetConversationsInternalAsync(
            userId,
            request,
            conversationRepository.GetRejectedConversationsCountAsync,
            conversationRepository.GetRejectedConversationsAsync);
    }
    
    /// <summary>
    /// Samlet logikk til alle endepunktene som henter samtaler - Aktive, pending, arkivert og rejected.
    /// Teller antall samtaler og henter ut antall samtaler bedt om i requesten som et ConversationDto.
    /// Henter brukerne fra cache og mapper til ConversationsResponse.
    /// </summary>
    /// <param name="userId">Brukeren som henter samtaler</param>
    /// <param name="request">PaginationRequest med page og pagesize</param>
    /// <param name="getCountAsync">Repository metode for å telle valgt samtale variant</param>
    /// <param name="getConversationsAsync">Repository metode for å hente valgt samtale variant</param>
    /// <returns>Result med ConversationResponse</returns>
    private async Task<Result<ConversationsResponse>> GetConversationsInternalAsync(
        string userId, PaginationRequest request,
        Func<string, Task<int>> getCountAsync,
        Func<string, int, int, Task<List<ConversationDto>>> getConversationsAsync)
    {
        // Teller antall samtaler vi skal hente
        var totalCount = await getCountAsync(userId);
        
        // Returner raskt hvis vi ikke finner noen samtaler
        if (totalCount == 0)
        {
            return Result<ConversationsResponse>.Success(
                new List<ConversationResponse>().ToResponse(0, request.Page, request.PageSize));
        }
        
        // Henter samtalene
        var conversationDtos = await getConversationsAsync(
            userId, request.Page, request.PageSize);
        
        // Henter brukere for cache
        var userIds = conversationDtos
            .SelectMany(c => c.Participants
                .Select(p => p.UserId))
            .Distinct()
            .ToList();
        
        // Henter cachede brukere
        var users = await userSummariesCache.GetUserSummariesAsync(userIds);
        
        // Bygger responsene
        var conversationResponses = conversationDtos
            .Select(dto => dto.ToResponse(users))
            .ToList();
        
        // Returnerer responsene i en ConversationsResponse med paginering info
        return Result<ConversationsResponse>.Success(conversationResponses
            .ToResponse(totalCount, request.Page, request.PageSize));
    }
    
   
    
    // Sjekk interface for summary
    public async Task<Result<ConversationsResponse>> SearchConversationsAsync(string userId, 
        ConversationSearchRequest request)
    {
        // Henter ut alle samtaler som stemmer med queryen
        var totalCount = await conversationRepository.GetTotalConversationsBySearch(
            userId, request.Query);
        
        // Henter ut alle samtalene klare som en ConversationDto
        var conversationDtos = await conversationRepository.GetConversationDtosBySearch(
            userId, request.Query, request.Page, request.PageSize);
        
        // Henter brukere for cache
        var userIds = conversationDtos.SelectMany(c => c.Participants
                .Select(p => p.UserId))
            .Distinct()
            .ToList();
        
        // Henter cachede brukere
        var users = await userSummariesCache.GetUserSummariesAsync(userIds);
        
        // Bygger responsen
        var conversationResponses = conversationDtos
            .Select(dto => dto.ToResponse(users))
            .ToList();
        
        // Returnerer responsene i en ConversationsResponse med paginering info
        return Result<ConversationsResponse>.Success(conversationResponses
            .ToResponse(totalCount, request.Page, request.PageSize));
    }
    
    // Sjekk interface for summary
    public async Task<Result> ArchiveConversationAsync(string userId, int conversationId)
    {
        // Henter ut samtalen
        var conversation = await conversationRepository.GetConversationWithTrackingAsync(conversationId);
        
        // Samtalen eksisterer ikke
        if (conversation == null)
        {
            logger.LogError("User {UserId} is trying to archive conversation {ConversationId} that does not exist",
                userId, conversationId);
            return Result.Failure("Conversation does not exist", ErrorTypeEnum.NotFound);
        }
        
        // Henter ut brukeren
        var participant = conversation.Participants.FirstOrDefault(cp => cp.UserId == userId);
        
        // Sjekker at brukeren er i samtalen
        if (participant == null)
        {
            logger.LogError("User {UserId} is trying to archive conversation {ConversationId} without being a " +
                            "participant" ,
                userId, conversationId);
            return Result.Failure("Conversation does not exist", ErrorTypeEnum.NotFound);
        }
        
        // Sjekker at brukeren ikke allerede har slettet samtalen
        if (participant.ConversationArchived)
        {
            logger.LogError("User {UserId} is trying to archive already archived conversation {ConversationId}",
                userId, conversationId);
            return Result.Failure("You have already deleted this conversation", ErrorTypeEnum.BadRequest);
        }
        
        // Feil endepunkt for gruppesamtaler
        if (participant.Conversation.Type == ConversationType.GroupChat)
        {
            logger.LogError("User {UserId} is trying to archive group conversation {ConversationId}" ,
                userId, conversationId);
            return Result.Failure("Wrong endpoint for group conversations", ErrorTypeEnum.BadRequest); 
        }
        
        // Oppdaterer conversationParticipants
        participant.ConversationArchived = true;
        participant.ArchivedAt = DateTime.UtcNow;
        
        // Sletter fra CanSend
        var allParticipantsIds = conversation.Participants.Select(cp => cp.UserId);
        foreach (var participantId in allParticipantsIds)
        {
            try
            {
                await msgCache.OnCanSendRemovedAsync(participantId, conversationId);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error during deleting from CanSend. " +
                                    "AppUser: {UserId}, Conversations: {ConversationId}", userId, conversationId);
            }
        }
        
        // Lagrer samtalen
        await conversationRepository.SaveChangesAsync();
        
        // Oppretter en syncevent til andre enheter for brukeren
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
        // Henter ut samtalen
        var conversation = await conversationRepository.GetConversationWithTrackingAsync(conversationId);
        
        // Samtalen eksisterer ikke
        if (conversation == null)
        {
            logger.LogError("User {UserId} is trying to archive conversation {ConversationId} that does not exist",
                userId, conversationId);
            return Result<ConversationResponse>.Failure("Conversation does not exist", ErrorTypeEnum.NotFound);
        }
        
        // Henter ut brukeren
        var participant = conversation.Participants.FirstOrDefault(cp => cp.UserId == userId);
        
        // Sjekker at brukeren er i samtalen
        if (participant == null)
        {
            logger.LogError("User {UserId} is trying to archive conversation {ConversationId} without being a " +
                            "participant" ,
                userId, conversationId);
            return Result<ConversationResponse>.Failure("Conversation does not exist", ErrorTypeEnum.NotFound);
        }
        
        // Sjekker at brukeren har arkivert samtalen
        if (!participant.ConversationArchived)
        {
            logger.LogError("User {UserId} is trying to restore non-archived conversation {ConversationId}",
                userId, conversationId);
            return Result<ConversationResponse>.Failure("You have not deleted this conversation");
        }
        
        // Feil endepunkt for gruppesamtaler
        if (participant.Conversation.Type == ConversationType.GroupChat)
        {
            logger.LogError("User {UserId} is trying to restore group conversation {ConversationId}" ,
                userId, conversationId);
            return Result<ConversationResponse>.Failure("Wrong endpoint for group conversations"); 
        }
        
        // Henter den andre brukern i samtalen for Syncevent og CanSend
        var otherParticipant = conversation.Participants.FirstOrDefault(cp => cp.UserId != userId);
        
        if (otherParticipant == null)
        {
            logger.LogCritical("User {UserId} is trying to restore conversation {ConversationId} and there is no" +
                               " other participants in the conversation" ,
                userId, conversationId);
            return Result<ConversationResponse>.Failure("Server error. Try again later or contact support"); 
        }
        
        // Oppdaterer conversationParticipants
        participant.ConversationArchived = false;
        participant.ArchivedAt = null;
        
        // Legger til CanSend igjen hvis begge brukerne har akseptert samtalen
        try
        {
            if (otherParticipant.Status == ConversationStatus.Accepted)
            {  
                await msgCache.OnCanSendAddedAsync(otherParticipant.UserId, conversationId);
                await msgCache.OnCanSendAddedAsync(participant.UserId, conversationId);
            }
        }
        catch (Exception ex)
        { 
            logger.LogError(ex, "Error during deleting from CanSend. " +
                                  "AppUser: {UserId}, Conversations: {ConversationId}", userId, conversationId);
        }
        
        // Lagrer samtalen
        await conversationRepository.SaveChangesAsync();
        
        // Henter ConversationDto
        var result = await GetConversationAsync(userId, conversationId);
        
        // Hvis det feiler
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
        
        var response = result.Value;
        
        // Oppretter en syncevent til andre enheter for brukeren
        try
        {
            await syncService.CreateSyncEventsAsync([userId], SyncEventType.ConversationRestored, 
                response!);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, 
                "Failed to create sync event for archived conversation {ConversationId}, " +
                "but conversation was archived successfully", 
                conversationId);
        }
        
        return Result<ConversationResponse>.Success(response!);
    }
    
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
            var messageResult = await messageService.SendMessageAsync(messageRequest, userId);
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
        
        // Sjekk blokkeringer
        if (await userBlockRepository.IsFirstUserBlockedBySecondary(request.ReceiverId, userId))
        {
            return Result<SendMessageToUserResponse>.Failure(
                "You cannot send messages to a user you have blocked", 
                ErrorTypeEnum.Forbidden);
        }
    
        if (await userBlockRepository.IsFirstUserBlockedBySecondary(userId, request.ReceiverId))
        {
            return Result<SendMessageToUserResponse>.Failure(
                "This user has been deleted, is no longer visible," +
                " or you lack the required permission to send messages.", 
                ErrorTypeEnum.Forbidden);
        }
        
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
                await msgCache.OnCanSendAddedAsync(userId, createdConversation.Id);
                await msgCache.OnCanSendAddedAsync(request.ReceiverId, createdConversation.Id);
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
        
        // Henter samtalen med tracking for å kunne oppdatere
        var conversation = await conversationRepository.GetConversationWithTrackingAsync(conversationId);
        
        // Samtalen eksisterer ikke
        if (conversation == null)
        {
            logger.LogError("User {UserId} tried to accept non-existent conversation {ConversationId}",
                userId, conversationId);
            return Result<ConversationResponse>.Failure("Conversation not found", ErrorTypeEnum.NotFound);
        }
        
        // Sjekk at samtalen er en PendingRequest
        if (conversation.Type != ConversationType.PendingRequest)
        {
            logger.LogError("User {UserId} tried to accept conversation {ConversationId} that is not pending " +
                            "(Type: {Type})",
                userId, conversationId, conversation.Type);
            return Result<ConversationResponse>.Failure("Conversation is not a pending request");
        }
        
        // Finn brukerens participant-record
        var userParticipant = conversation.Participants.FirstOrDefault(p => p.UserId == userId);
        
        // Sjekker at brukeren er participant
        if (userParticipant == null)
        {
            logger.LogError("User {UserId} tried to accept conversation {ConversationId} without being a participant",
                userId, conversationId);
            return Result<ConversationResponse>.Failure("Conversation not found", ErrorTypeEnum.Forbidden);
        }
        
        // Sjekk at brukeren er mottakeren (PendingRecipient)
        if (userParticipant.Role != ParticipantRole.PendingRecipient)
        {
            logger.LogError("User {UserId} tried to accept conversation {ConversationId} but is not the recipient " +
                            "(Role: {Role})",
                userId, conversationId, userParticipant.Role);
            return Result<ConversationResponse>.Failure("You cannot accept a conversation you initiated");
        }
        
        // Sjekk at brukeren har Pending status
        if (userParticipant.Status == ConversationStatus.Accepted)
        {
            logger.LogError("User {UserId} tried to accept conversation {ConversationId} but status is {Status}",
                userId, conversationId, userParticipant.Status);
            return Result<ConversationResponse>.Failure("Conversation has already been accepted");
        }
        
        // Finn den andre participanten (senderen)
        var senderParticipant = conversation.Participants.FirstOrDefault(p => p.UserId != userId);
        
        if (senderParticipant == null)
        {
            logger.LogCritical("Conversation {ConversationId} has no sender participant", conversationId);
            return Result<ConversationResponse>.Failure("Server error. Try again later or contact support", 
                ErrorTypeEnum.InternalServerError);
        }
        
        // ============ TRANSAKSJON: Oppdater database ============
        
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
            await msgCache.OnCanSendAddedAsync(userId, conversationId);
            await msgCache.OnCanSendAddedAsync(senderParticipant.UserId, conversationId);
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
        
        // Henter samtalen med tracking for å kunne oppdatere
        var conversation = await conversationRepository.GetConversationWithTrackingAsync(conversationId);
        
        // Samtalen eksisterer ikke
        if (conversation == null)
        {
            logger.LogError("User {UserId} tried to reject non-existent conversation {ConversationId}",
                userId, conversationId);
            return Result.Failure("Conversation not found", ErrorTypeEnum.NotFound);
        }
        
        // Sjekk at samtalen er en PendingRequest
        if (conversation.Type != ConversationType.PendingRequest)
        {
            logger.LogError("User {UserId} tried to reject conversation {ConversationId} that is not pending " +
                            "(Type: {Type})",
                userId, conversationId, conversation.Type);
            return Result.Failure("Conversation is not a pending request", ErrorTypeEnum.BadRequest);
        }
        
        // Finn brukerens participant-record
        var userParticipant = conversation.Participants.FirstOrDefault(p => p.UserId == userId);
        
        // Sjekker at brukeren er participant
        if (userParticipant == null)
        {
            logger.LogError("User {UserId} tried to reject conversation {ConversationId} without being a participant",
                userId, conversationId);
            return Result.Failure("Conversation not found", ErrorTypeEnum.Forbidden);
        }
        
        // Sjekk at brukeren er mottakeren (PendingRecipient)
        if (userParticipant.Role != ParticipantRole.PendingRecipient)
        {
            logger.LogError("User {UserId} tried to reject conversation {ConversationId} but is not the recipient " +
                            "(Role: {Role})",
                userId, conversationId, userParticipant.Role);
            return Result.Failure("You cannot reject a conversation you initiated", ErrorTypeEnum.BadRequest);
        }
        
        // Sjekk at brukeren ikke allerede har akseptert
        if (userParticipant.Status != ConversationStatus.Pending)
        {
            logger.LogError("User {UserId} tried to reject conversation {ConversationId} but status is not pending. " +
                            "Status: {Status}", userId, conversationId, userParticipant.Status);
            return Result.Failure("Conversation has already been accepted", ErrorTypeEnum.BadRequest);
        }
        
        // ============ TRANSAKSJON: Oppdater database ============
        
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
