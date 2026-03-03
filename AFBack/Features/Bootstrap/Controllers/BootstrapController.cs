using AFBack.Common.Controllers;
using AFBack.Features.Bootstrap.DTOs.Responses;
using AFBack.Features.Bootstrap.Services;
using AFBack.Infrastructure.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AFBack.Features.Bootstrap.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class BootstrapController(IBootstrapService bootstrapService) : BaseController
{
    // ======================== Signup ======================== 
    /// <summary>
    /// Hent Critical Bootstrap endepunkt
    /// </summary>
    /// <returns>200 Ok</returns>
    [HttpGet("critical")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(CriticalBootstrapResponse), StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<CriticalBootstrapResponse>> GetCriticalBootstrap()
    {
        var userId = User.GetUserId();
        var result = await bootstrapService.GetCriticalBootstrapAsync(userId);
        
        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }
    
    /// <summary>
    /// Hent Critical Bootstrap endepunkt
    /// </summary>
    /// <returns>200 Ok</returns>
    [HttpPost("signup")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<SecondaryBootstrapResponse>> GetSecondaryBootstrap()
    {
        var userId = User.GetUserId();
        var result = await bootstrapService.GetSecondaryBootstrapAsync(userId);
        
        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }
}
