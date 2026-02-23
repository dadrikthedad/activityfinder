using AFBack.Common.Results;
using AFBack.Features.Searching.DTOs.Requests;
using AFBack.Features.Searching.DTOs.Responses;
using AFBack.Features.Searching.Repositories;

namespace AFBack.Features.Searching.Services;

public class SearchService(
    ILogger<SearchService> logger,
    ISearchRepository searchRepository) : ISearchService
{
    public async Task<Result<SearchUsersResponse>> SearchUsersAsync(
        string userId, SearchUsersRequest request)
    {
        var results = await searchRepository.SearchUsersAsync(
            request.Query, userId, request.Cursor, request.PageSize);

        var hasMore = results.Count > request.PageSize;
        if (hasMore)
            results.RemoveAt(results.Count - 1);

        string? nextCursor = null;
        if (hasMore && results.Count > 0)
        {
            var last = results[^1];
            nextCursor = $"{last.ProximityLevel}|{last.Id}";
        }

        return Result<SearchUsersResponse>.Success(new SearchUsersResponse
        {
            Users = results,
            NextCursor = nextCursor,
            HasMore = hasMore
        });
    }
    
    public async Task<Result<SearchUsersResponse>> QuickSearchUsersAsync(
        string userId, SearchUsersRequest request)
    {
        var results = await searchRepository.QuickSearchUsersAsync(
            request.Query, userId, request.Cursor, request.PageSize);

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
