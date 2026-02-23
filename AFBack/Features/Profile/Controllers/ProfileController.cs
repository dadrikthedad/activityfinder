using AFBack.Common.Controllers;
using AFBack.Features.Profile.DTOs.Requests;
using AFBack.Features.Profile.DTOs.Responses;
using AFBack.Features.Profile.Services;
using AFBack.Infrastructure.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AFBack.Features.Profile.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProfileController(IProfileService profileService) : BaseController
{
    
    // ======================== Oppdater lokasjon ========================

    /// <summary>
    /// Oppdaterer alle profilfelt for innlogget bruker
    /// </summary>
    [HttpPut]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var userId = User.GetUserId();
        var result = await profileService.UpdateProfileAsync(userId, request);

        if (result.IsFailure)
            return HandleFailure(result);

        return NoContent();
    }
    
    /// <summary>
    /// Henter egen profil (alle felt, for redigering)
    /// </summary>
    /// <returns>200 Ok med MyProfileResponse</returns>
    [HttpGet]
    [ProducesResponseType(typeof(MyProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMyProfile()
    {
        var userId = User.GetUserId();
        var result = await profileService.GetMyProfileAsync(userId);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }

    /// <summary>
    /// Henter en annen brukers offentlige profil (filtrert av deres innstillinger)
    /// </summary>
    /// <param name="targetUserId"></param>
    /// <returns>200 Ok med PublicProfile-response</returns>
    [HttpGet("{targetUserId}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PublicProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetPublicProfile([FromRoute] string targetUserId)
    {
        var userId = User.GetUserId();
        var result = await profileService.GetPublicProfileAsync(userId, targetUserId);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }
}
