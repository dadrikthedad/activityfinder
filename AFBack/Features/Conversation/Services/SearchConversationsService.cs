using AFBack.Common.Results;
using AFBack.Features.Conversation.DTOs.Request;
using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.Conversation.Extensions;
using AFBack.Features.Conversation.Repository;
using AFBack.Infrastructure.Cache;

namespace AFBack.Features.Conversation.Services;

public class SearchConversationsService(
    ILogger<SearchConversationsService> logger,
    IConversationRepository conversationRepository,
    IUserSummaryCacheService userSummariesCache) : ISearchConversationsService
{
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
}
