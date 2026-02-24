using AFBack.Common.Results;
using AFBack.Features.Searching.DTOs.Requests;
using AFBack.Features.Searching.DTOs.Responses;
using AFBack.Features.Searching.Repositories;

namespace AFBack.Features.Searching.Services;

public class SearchService(
    ISearchRepository searchRepository) : ISearchService
{
    /// <inheritdoc/>
    public async Task<Result<SearchUsersResponse>> SearchUsersAsync(string userId, SearchUsersRequest request)
    {
        // Henter en liste med UserSearchResults
        var results = await searchRepository.SearchUsersAsync(request.SearchQuery, 
            userId, request.Cursor, request.PageSize);
        
        // Henter en ekstra for å få en indikasjon om det er flere brukere, deretter fjerner vi den igjen
        var hasMore = results.Count > request.PageSize;
        if (hasMore)
            results.RemoveAt(results.Count - 1);
        
        // Setter nextCursor så vi vet hvor vi skal starte igjen fra neste gang
        string? nextCursor = null;
        if (hasMore && results.Count > 0)
        {
            // Henter ut siste brukeren i listen
            var last = results[^1];
            // Oppretter en ny cursor
            nextCursor = $"{last.ProximityLevel}|{last.Id}";
        }

        return Result<SearchUsersResponse>.Success(new SearchUsersResponse
        {
            Users = results,
            NextCursor = nextCursor,
            HasMore = hasMore
        });
    }
    
    /// <inheritdoc/>
    public async Task<Result<SearchUsersResponse>> QuickSearchUsersAsync(
        string userId, SearchUsersRequest request)
    {
        var results = await searchRepository.QuickSearchUsersAsync(request.SearchQuery, 
            userId, request.Cursor, request.PageSize);

        var hasMore = results.Count > request.PageSize;
        if (hasMore)
            results.RemoveAt(results.Count - 1);

        string? nextCursor = null;
        if (hasMore && results.Count > 0)
            nextCursor = results[^1].Id;

        return Result<SearchUsersResponse>.Success(new SearchUsersResponse
        {
            Users = results,
            NextCursor = nextCursor,
            HasMore = hasMore
        });
    }
    
    /// <inheritdoc/>
    public async Task<Result<SearchUsersResponse>> SearchUsersForInviteAsync(string userId, 
        SearchUsersForInviteRequest request)
    {
        // Utfører søket og får en liste med UserSearchResults
        var results = await searchRepository.SearchUsersForGroupInviteAsync(
            request.Query, userId, request.ConversationId, request.Cursor, request.PageSize);
        
        // Fjerner den ekstra brukeren for å bekrefte om det er flere brukere
        var hasMore = results.Count > request.PageSize;
        if (hasMore)
            results.RemoveAt(results.Count - 1);

        string? nextCursor = null;
        if (hasMore && results.Count > 0)
            nextCursor = results[^1].Id;

        return Result<SearchUsersResponse>.Success(new SearchUsersResponse
        {
            Users = results,
            NextCursor = nextCursor,
            HasMore = hasMore
        });
    }
}
