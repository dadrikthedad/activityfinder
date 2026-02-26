using AFBack.Common.DTOs;
using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Features.Blocking.Services;
using AFBack.Features.Broadcast.Services;
using AFBack.Features.Broadcast.Services.Interfaces;
using AFBack.Features.Conversation.Enums;
using AFBack.Features.Conversation.Repository;
using AFBack.Features.Conversation.Services;
using AFBack.Features.Friendship.DTOs.Responses;
using AFBack.Features.Friendship.Enums;
using AFBack.Features.Friendship.Repository;
using AFBack.Infrastructure.Cache;


namespace AFBack.Features.Friendship.Services;

public class FriendshipRequestService(
    ILogger<FriendshipRequestService> logger,
    IFriendshipRepository friendshipRepository,
    IBlockingService blockingService,
    IUserSummaryCacheService userSummaryCacheService,
    IFriendshipRequestRepository friendshipRequestRepository,
    IFriendshipBroadcastService friendshipBroadcastService,
    IConversationRepository conversationRepository,
    IDirectConversationService directConversationService) : IFriendshipRequestService
{
    
    // ======================= GET ======================= 
    /// <inheritdoc/>
    public async Task<Result<PaginatedResponse<PendingFriendshipRequestResponse>>> 
        GetReceivedPendingFriendshipRequestsAsync(string userId, int page, int pageSize)
    {
        logger.LogInformation("UserId: {UserId} fetching received friendship requests (Page: {Page}, PageSize: {PageSize})",
            userId, page, pageSize);
    
        var pendingRequests = await 
            friendshipRequestRepository.GetPendingReceivedRequestsAsync(userId, page, pageSize);
        var totalCount = await friendshipRequestRepository.GetPendingReceivedRequestsCountAsync(userId);
    
        if (pendingRequests.Count == 0)
            return Result<PaginatedResponse<PendingFriendshipRequestResponse>>.Success(
                new PaginatedResponse<PendingFriendshipRequestResponse>
                {
                    TotalCount = totalCount,
                    Page = page,
                    PageSize = pageSize
                });
    
        var senderIds = pendingRequests.Select(r => r.SenderId).ToList();
        var senderSummaries = await userSummaryCacheService.GetUserSummariesAsync(senderIds);
    
        var items = pendingRequests
            .Where(r => senderSummaries.ContainsKey(r.SenderId))
            .Select(r => new PendingFriendshipRequestResponse
            {
                RequestId = r.Id,
                Sender = senderSummaries[r.SenderId],
                SentAt = r.SentAt
            })
            .ToList();
    
        return Result<PaginatedResponse<PendingFriendshipRequestResponse>>.Success(
            new PaginatedResponse<PendingFriendshipRequestResponse>
            {
                Items = items,
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize
            });
    }
    
    /// <inheritdoc/>
    public async Task<Result<PaginatedResponse<PendingFriendshipRequestResponse>>> GetDeclinedFriendshipRequestsAsync(
        string userId, int page, int pageSize)
    {
        logger.LogInformation("UserId: {UserId} fetching declined friendship requests (Page: {Page}, PageSize: {PageSize})",
            userId, page, pageSize);
    
        var declinedRequests = await friendshipRequestRepository.GetDeclinedReceivedRequestsAsync(userId, page, pageSize);
        var totalCount = await friendshipRequestRepository.GetDeclinedReceivedRequestsCountAsync(userId);
    
        if (declinedRequests.Count == 0)
            return Result<PaginatedResponse<PendingFriendshipRequestResponse>>.Success(
                new PaginatedResponse<PendingFriendshipRequestResponse>
                {
                    TotalCount = totalCount,
                    Page = page,
                    PageSize = pageSize
                });
    
        var senderIds = declinedRequests.Select(r => r.SenderId).ToList();
        var senderSummaries = 
            await userSummaryCacheService.GetUserSummariesAsync(senderIds);
    
        var items = declinedRequests
            .Where(r => senderSummaries.ContainsKey(r.SenderId))
            .Select(r => new PendingFriendshipRequestResponse
            {
                RequestId = r.Id,
                Sender = senderSummaries[r.SenderId],
                SentAt = r.SentAt
            })
            .ToList();
    
        return Result<PaginatedResponse<PendingFriendshipRequestResponse>>.Success(
            new PaginatedResponse<PendingFriendshipRequestResponse>
            {
                Items = items,
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize
            });
    }
    
    // ======================= SEND FRIENDSHIP REQUEST ======================= 
    
    /// <inheritdoc/>
    public async Task<Result<SendFriendshipRequestResponse>> SendFriendshipRequestAsync(string senderId,
        string receiverId)
    {
        logger.LogInformation("UserId: {SenderId}, sending friendship request to UserId: {ReceiverId}", 
            senderId, receiverId);
        
        // Kan ikke sende forespørsel til seg selv
        if (senderId == receiverId)
            return Result<SendFriendshipRequestResponse>.Failure("You cannot send a " +
                                                                 "friendship request to yourself.");
        
        // ====== Finn sender ======
        var senderSummaryDto = await userSummaryCacheService.GetUserSummaryAsync(senderId);
        if (senderSummaryDto == null)
        {
            logger.LogWarning("User sending friendship request does not exist. UserId: {SenderId}", senderId);
            return Result<SendFriendshipRequestResponse>.Failure("User not found", ErrorTypeEnum.NotFound);
        }
        
        // ====== Finn mottaker ======
        var receiverSummaryDto = await userSummaryCacheService.GetUserSummaryAsync(receiverId);
        if (receiverSummaryDto == null)
        {
            logger.LogWarning("User receiving friendship request does not exist. UserId: {UserId}", receiverId);
            return Result<SendFriendshipRequestResponse>.Failure("User not found", ErrorTypeEnum.NotFound);
        }
        
        // ====== Sjekker at brukerne ikke har blokkert hverandre ======
        var blockedResult = await blockingService.ValidateNoBlockingsAsync(senderId, receiverId);
        if (blockedResult.IsFailure)
            return Result<SendFriendshipRequestResponse>.Failure(blockedResult.Error, blockedResult.ErrorType);
        
        // ====== Sjekker eksisterende venneforespørsel ======
        var existingResult = await HandleExistingFriendshipRequestAsync(senderId, receiverId);
        if (existingResult != null)
            return existingResult;
        
        // ====== Database-lagring ======
        
        var friendshipRequest = new Models.FriendshipRequest
        {
            SenderId = senderId,
            ReceiverId = receiverId
        };
        
        await friendshipRequestRepository.AddFriendshipRequestAsync(friendshipRequest);
        
        // ====== Post-commit: Notification, SignalR og SyncEvent ======
        await friendshipBroadcastService.BroadcastFriendshipRequestSentAsync(
            senderId, receiverId, friendshipRequest.Id, friendshipRequest.SentAt, senderSummaryDto);

        return Result<SendFriendshipRequestResponse>.Success(new SendFriendshipRequestResponse());
    }
    
    // ======================= ACCEPT FRIENDSHIP ======================= 
    
    /// <inheritdoc/>
    public async Task<Result<FriendshipAcceptedResponse>> AcceptFriendshipRequestAsync(string accepterId, int requestId)
    {
        logger.LogInformation("UserId: {UserId} accepting friendship request {RequestId}", accepterId, requestId);
        
        // ====== Hent forespørselen ======
        var friendshipRequest = await friendshipRequestRepository.GetFriendshipRequestByIdAsync(requestId);
        if (friendshipRequest is null)
        {
            logger.LogWarning("Friendship request {RequestId} not found", requestId);
            return Result<FriendshipAcceptedResponse>.Failure("Friendship request not found", 
                ErrorTypeEnum.NotFound);
        }
        
        // ====== Kun mottaker kan akseptere ======
        if (friendshipRequest.ReceiverId != accepterId)
        {
            logger.LogWarning("UserId: {UserId} tried to accept friendship request {RequestId} they are not the " +
                              "receiver of", accepterId, requestId);
            return Result<FriendshipAcceptedResponse>.Failure("You are not authorized to accept this request", 
                ErrorTypeEnum.Forbidden);
        }
        
        // ====== Allerede akseptert ======
        if (friendshipRequest.Status == FriendshipRequestStatus.Accepted)
        {
            logger.LogInformation("Friendship request {RequestId} is already accepted", requestId);
            return Result<FriendshipAcceptedResponse>.Failure("You are already friends with this user.", 
                ErrorTypeEnum.Conflict);
        }
        
        // ====== Oppdater request og opprett Friendship ======
        friendshipRequest.Status = FriendshipRequestStatus.Accepted;
        
        var friendship = new Models.Friendship
        {
            UserId = friendshipRequest.SenderId,
            FriendId = friendshipRequest.ReceiverId,
            CreatedAt = DateTime.UtcNow
        };
        
        await friendshipRepository.AddFriendshipAsync(friendship);
        await friendshipRepository.SaveChangesAsync();
        
        // ====== Auto-aksepter eventuell pending samtale mellom brukerne ======
        var conversation = await conversationRepository.GetConversationBetweenUsersAsync(
            accepterId, friendshipRequest.SenderId);

        if (conversation != null && conversation.Type == ConversationType.PendingRequest)
        {
            var conversationPendingRecipient = conversation.Participants.FirstOrDefault(cp
                => cp.Role == ParticipantRole.PendingRecipient);
            
            var acceptResult = await directConversationService.AcceptPendingConversationRequestAsync(
                conversationPendingRecipient!.UserId, conversation.Id);

            if (acceptResult.IsFailure)
                logger.LogWarning("Failed to auto-accept pending conversation {ConversationId} between " +
                                      "{SenderId} and {ReceiverId}",
                    conversation.Id, friendshipRequest.SenderId, friendshipRequest.ReceiverId);
        }
        
        // ====== Post-commit: Notification, SignalR og SyncEvent ======
        
        var senderSummaryDto = await userSummaryCacheService.GetUserSummaryAsync(friendshipRequest.SenderId);
        var accepterSummaryDto = await userSummaryCacheService.GetUserSummaryAsync(accepterId);
        
        await friendshipBroadcastService.BroadcastFriendshipRequestAcceptedAsync(
            accepterId, friendshipRequest.SenderId, requestId, accepterSummaryDto!, senderSummaryDto!);
        
        return Result<FriendshipAcceptedResponse>.Success(new FriendshipAcceptedResponse
        {
            Friend = senderSummaryDto!
        });
    }
    
    /// <summary>
    /// Sjekker om det allerede eksisterer en venneforespørsel mellom brukerne.
    /// Returnerer null hvis ingen eksisterer og vi kan fortsette med ny forespørsel.
    /// Returnerer Result hvis vi fant en eksisterende (enten feil eller auto-accept).
    /// </summary>
    /// <param name="senderId">Sender av ny forespørsel</param>
    /// <param name="receiverId">Mottaker av ny forespørsel</param>
    /// <returns>Result med SendFriendshipRequestResponse eller Failure, null hvis ingen eksisterer</returns>
    private async Task<Result<SendFriendshipRequestResponse>?> HandleExistingFriendshipRequestAsync(
        string senderId, string receiverId)
    {
        var existingFriendshipRequest = await friendshipRequestRepository.GetFriendshipRequestAsync(senderId, receiverId);
        if (existingFriendshipRequest == null)
            return null;
        
        if (existingFriendshipRequest.Status == FriendshipRequestStatus.Accepted)
        {
            logger.LogError("UserId: {SenderId}, is already friends with UserId: {ReceiverId}", 
                senderId, receiverId);
            return Result<SendFriendshipRequestResponse>.Failure("You are already friends with this user.", 
                ErrorTypeEnum.Conflict);
        }
            
        // Hvis sender er den som sendte originalt → allerede sendt
        if (existingFriendshipRequest.SenderId == senderId)
        {
            logger.LogInformation(
                "UserId: {SenderId} tried to send duplicate friendship request to UserId: {ReceiverId}. " +
                "Status: {Status}", senderId, receiverId, existingFriendshipRequest.Status);
            return Result<SendFriendshipRequestResponse>.Failure(
                "Friend request is already sent", ErrorTypeEnum.Conflict);
        }
            
        // Mottaker sender tilbake → auto-aksepter
        // Vi kaller på AcceptFriendshipRequest som håndterer database, oppdatering,
        // SignalR og SyncEvent for begge brukere
        var friendshipAcceptedResponse = 
            await AcceptFriendshipRequestAsync(senderId, existingFriendshipRequest.Id);
        if (friendshipAcceptedResponse.IsFailure)
            return Result<SendFriendshipRequestResponse>.Failure(friendshipAcceptedResponse.Error, 
                friendshipAcceptedResponse.ErrorType);
            
        return Result<SendFriendshipRequestResponse>.Success(new SendFriendshipRequestResponse
        {
            IsAccepted = true,
            FriendshipAccepted = friendshipAcceptedResponse.Value
        });
    }
    
    // ======================= DECLINE FRIENDSHIP ======================= 
    
    /// <inheritdoc/>
    public async Task<Result> DeclineFriendshipRequestAsync(string userId, int requestId)
    {
        logger.LogInformation("UserId: {UserId} declining friendship request {RequestId}", userId, requestId);
    
        // ====== Hent forespørselen ======
        var friendshipRequest = await friendshipRequestRepository.GetFriendshipRequestByIdAsync(requestId);
        if (friendshipRequest is null)
        {
            logger.LogWarning("Friendship request {RequestId} not found", requestId);
            return Result.Failure("Friendship request not found", ErrorTypeEnum.NotFound);
        }
    
        // ====== Kun mottaker kan avslå ======
        if (friendshipRequest.ReceiverId != userId)
        {
            logger.LogWarning("UserId: {UserId} tried to decline friendship request {RequestId} they are not the " +
                              "receiver of", userId, requestId);
            return Result.Failure("You are not authorized to decline this request", ErrorTypeEnum.Forbidden);
        }
    
        // ====== Allerede håndtert ======
        if (friendshipRequest.Status != FriendshipRequestStatus.Pending)
        {
            logger.LogWarning("UserId: {UserId} tried to decline friendship request {RequestId} with status {Status}",
                userId, requestId, friendshipRequest.Status);
            return Result.Failure("This request has already been handled", ErrorTypeEnum.Conflict);
        }
    
        // ====== Database: Oppdater status ======
        friendshipRequest.Status = FriendshipRequestStatus.Declined;
        await friendshipRequestRepository.SaveChangesAsync();
    
        logger.LogInformation("UserId: {UserId} successfully declined friendship request {RequestId}", 
            userId, requestId);
    
        // ====== Post-commit: SyncEvent til egne enheter ======
        await friendshipBroadcastService.BroadcastFriendshipRequestDeclinedAsync(userId, requestId);
    
        return Result.Success();
    }
    
    
}
