using AFBack.Common.Controllers;
using AFBack.Features.Searching.DTOs.Requests;
using AFBack.Features.Searching.DTOs.Responses;
using AFBack.Features.Searching.Services;
using AFBack.Infrastructure.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AFBack.Features.Searching.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SearchController(ISearchService searchService) : BaseController
{
    /// <summary>
    /// Søker etter brukere basert på navn, sortert etter nærhet
    /// </summary>
    [HttpGet("users")]
    [ProducesResponseType(typeof(SearchUsersResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> SearchUsers([FromQuery] SearchUsersRequest request)
    {
        var userId = User.GetUserId();
        var result = await searchService.SearchUsersAsync(userId, request);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }
    
    /// <summary>
    /// Enkelt navnesøk etter brukere
    /// </summary>
    [HttpGet("users/quick")]
    [ProducesResponseType(typeof(SearchUsersResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> QuickSearchUsers([FromQuery] SearchUsersRequest request)
    {
        var userId = User.GetUserId();
        var result = await searchService.QuickSearchUsersAsync(userId, request);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }
}
