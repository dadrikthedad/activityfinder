using AFBack.Common.Controllers;
using AFBack.Features.Settings.DTOs.Requests;
using AFBack.Features.Settings.DTOs.Responses;
using AFBack.Features.Settings.Services;
using AFBack.Infrastructure.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AFBack.Features.Settings.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SettingsController(ISettingsService settingsService) : BaseController
{
    /// <summary>
    /// Henter innstillinger for innlogget bruker
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(SettingsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSettings()
    {
        var userId = User.GetUserId();
        var result = await settingsService.GetSettingsAsync(userId);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }

    /// <summary>
    /// Oppdaterer alle innstillinger for innlogget bruker
    /// </summary>
    [HttpPut]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> UpdateSettings([FromBody] UpdateSettingsRequest request)
    {
        var userId = User.GetUserId();
        var result = await settingsService.UpdateSettingsAsync(userId, request);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok();
    }
}
