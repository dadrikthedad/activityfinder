using AFBack.Common.Results;
using AFBack.Features.Searching.DTOs.Requests;
using AFBack.Features.Searching.DTOs.Responses;

namespace AFBack.Features.Searching.Services;

public interface ISearchService
{
    /// <summary>
    /// Søker igjennom alle bruker med Cursor-tilnærmingen. Bruker ProximityLevel utifra lokasjonen til
    /// innlogget bruker. Cursor: Proximity, Navn, så Id: "2|Kari Hansen|abc123"
    /// </summary>
    /// <param name="userId">Brukeren som søker</param>
    /// <param name="request">SearchUsersRequest med søkequery, cursor og pageSize</param>
    /// <returns>SearchUsersResponse - liste med Users, NextCursor og HasMore</returns>
    Task<Result<SearchUsersResponse>> SearchUsersAsync(string userId, SearchUsersRequest request);
    
    /// <summary>
    /// Henter et raskere søk uten Proximity. Sjekke hastighet senere. Cursor: ID: "abc123kdsolaik"
    /// </summary>
    /// <param name="userId">Brukeren som søker</param>
    /// <param name="request">SearchUsersRequest med søkequery, cursor og pageSize</param>
    /// <returns>SearchUsersResponse - liste med Users, NextCursor og HasMore</returns>
    Task<Result<SearchUsersResponse>> QuickSearchUsersAsync(string userId, SearchUsersRequest request);
    
    Task<Result<SearchUsersResponse>> SearchUsersForInviteAsync(string userId, SearchUsersForInviteRequest request);
}
