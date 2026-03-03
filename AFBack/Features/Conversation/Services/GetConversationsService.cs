using AFBack.Common.DTOs;
using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Features.Conversation.DTOs;
using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.Conversation.Extensions;
using AFBack.Features.Conversation.Repository;
using AFBack.Infrastructure.Cache;

namespace AFBack.Features.Conversation.Services;

public class GetConversationsService(
    ILogger<GetConversationsService> logger,
    IConversationRepository conversationRepository,
    IUserSummaryCacheService userSummariesCache) : IGetConversationsService
{
     /// <inheritdoc />
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
    
    
    /// <inheritdoc />
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
    
    /// <inheritdoc />
    public async Task<Result<ConversationsResponse>> GetPendingConversationsAsync(
        string userId, PaginationRequest request)
    {
        logger.LogInformation("Getting pending conversations for User {UserId}", userId);
        
        return await GetConversationsInternalAsync(userId, request,
            conversationRepository.GetPendingConversationsCountAsync,
            conversationRepository.GetPendingConversationsAsync);
    }
    
    /// <inheritdoc />
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
    
    /// <inheritdoc />
    public async Task<Result<ConversationsResponse>> GetRejectedConversationsAsync(
        string userId, PaginationRequest request)
    {
        logger.LogInformation("Getting rejected conversations for User {UserId}", userId);
        
        return await GetConversationsInternalAsync(userId, request,
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
}
