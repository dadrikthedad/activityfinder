using AFBack.Features.Searching.DTOs.Responses;

namespace AFBack.Features.Searching.Repositories;

public interface ISearchRepository
{
    Task<List<UserSearchResult>> SearchUsersAsync(string query, string requestingUserId, 
        string? cursor, int pageSize);
    
    Task<List<UserSearchResult>> QuickSearchUsersAsync(
        string query, string requestingUserId, string? cursor, int pageSize);
}
