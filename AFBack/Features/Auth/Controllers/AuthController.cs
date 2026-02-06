using AFBack.Controllers;
using AFBack.Features.Auth.DTOs.Request;
using AFBack.Features.Auth.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AFBack.Features.Auth.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AuthController(IAuthService authService) : BaseController
{
    /// <summary>
    /// Signup endepunktet - Registrerer en ny bruker med epost som username og passord
    /// </summary>
    /// <param name="request">Email, Password and Confirm Password</param>
    /// <returns>Ok or BadRequest</returns>
    [HttpPost("signup")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> SignUp([FromBody] SignupRequest request)
    {
        var result = await authService.SignupAsync(request);
        
        if (result.IsFailure)
            return Problem(detail: result.Error, statusCode: StatusCodes.Status400BadRequest);
      
        return Ok(result.Data);
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var result = await authService.LoginAsync(request);
        
        if (result.IsFailure)
            return Problem(detail: result.Error, statusCode: StatusCodes.Status400BadRequest);
      
        return Ok(result.Data);
    }

}
