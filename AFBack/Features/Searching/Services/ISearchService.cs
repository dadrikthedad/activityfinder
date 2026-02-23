using AFBack.Common.Results;
using AFBack.Features.Searching.DTOs.Requests;
using AFBack.Features.Searching.DTOs.Responses;

namespace AFBack.Features.Searching.Services;

public interface ISearchService
{
    Task<Result<SearchUsersResponse>> SearchUsersAsync(string userId, SearchUsersRequest request);
    
    Task<Result<SearchUsersResponse>> QuickSearchUsersAsync(string userId, SearchUsersRequest request);
}
