using AFBack.Common.Controllers;
using AFBack.Features.Auth.DTOs.Request;
using AFBack.Features.Auth.DTOs.Response;
using AFBack.Features.Auth.Services.Interfaces;
using AFBack.Infrastructure.Constants;
using AFBack.Infrastructure.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace AFBack.Features.Auth.Controllers;

[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting(RateLimitPolicies.Auth)]
[Authorize]
public class AuthController(IAuthService authService) : BaseController
{
    // ======================== Signup ======================== 
    /// <summary>
    /// Signup endepunktet - Registrerer en ny bruker med epost som username og passord
    /// </summary>
    /// <param name="request">Email, Password and Confirm Password</param>
    /// <returns>201 CreatedAt eller BadRequest</returns>
    [HttpPost("signup")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<SignupResponse>> SignUp([FromBody] SignupRequest request)
    {
        var ipAddress = GetIpAddress();
        
        var result = await authService.SignupAsync(request, ipAddress);
        
        if (result.IsFailure)
            return HandleFailure(result);

        return CreatedAtAction(nameof(SignUp), new { id = result.Value!.UserId }, result.Value);
    }
    
    // ======================== Login ======================== 
    
    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var ipAddress = GetIpAddress();
    
        var userAgent = Request.Headers.UserAgent.ToString();
    
        var result = await authService.LoginAsync(request, ipAddress, userAgent);
    
        if (result.IsFailure)
            return HandleFailure(result);
    
        return Ok(result.Value);
    }
    
    
    
    // ======================== Logout ======================== 
    
    /// <summary>
    /// Logger ut fra nåværende device. Revokerer refresh token og blacklister access token.
    /// Henter ut brukerId, JTI og expiry fra Token
    /// </summary>
    /// <param name="request">LogoutRequest</param>
    /// <returns>Ok 200</returns>
    [HttpPost("logout")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Logout([FromBody] LogoutRequest request)
    {
        var userId = User.GetUserId();
        var accessTokenJti = User.GetJti();
        var accessTokenExpiry = User.GetAccessTokenExpiry();
        var deviceId = User.GetDeviceId();
    
        await authService.LogoutAsync(userId, request.RefreshToken, accessTokenJti,
            accessTokenExpiry,deviceId);
    
        return Ok();
    }
    
    /// <summary>
    /// Logger ut fra alle devices. Revokerer alle refresh tokens.
    /// Henter ut brukerId, JTI og expiry fra Token
    /// </summary>
    /// <returns>200 Ok</returns>
    [HttpPost("logout-all")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> LogoutAllDevices()
    {                     
        var userId = User.GetUserId();
        var accessTokenJti = User.GetJti();
        var accessTokenExpiry = User.GetAccessTokenExpiry();
    
        var result = await authService.LogoutAllDevicesAsync(userId, accessTokenJti, accessTokenExpiry);
    
        if (result.IsFailure)
            return HandleFailure(result);
    
        return Ok();
    }
    
    // ======================== Sikkerhetsvarsling ========================
    
    /// <summary>
    /// "This wasn't me"-endepunkt. Låser kontoen, nullstiller alle pending-endringer,
    /// og sender passord-reset epost. Uautentisert — brukes fra epost-lenke.
    /// </summary>
    [HttpPost("report-unauthorized-change")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ReportUnauthorizedChange([FromQuery] string token)
    {
        var ipAddress = GetIpAddress();
    
        var result = await authService.ReportUnauthorizedChangeAsync(token, ipAddress);
    
        if (result.IsFailure)
            return HandleFailure(result);
    
        return Ok();
    }
}
