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
    /// <param name="ct"></param>
    /// <returns>201 CreatedAt eller BadRequest</returns>
    [HttpPost("signup")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<SignupResponse>> SignUp([FromBody] SignupRequest request, 
        CancellationToken ct = default)
    {
        var ipAddress = GetIpAddress();
        
        var result = await authService.SignupAsync(request, ipAddress, ct);
        
        if (result.IsFailure)
            return HandleFailure(result);

        return CreatedAtAction(nameof(SignUp), new { id = result.Value!.UserId }, result.Value);
    }
    
    // ======================== Login ======================== 
    /// <summary>
    /// Steg 1 av innlogging. Validerer epost og passord, sjekker lockout og kontoverifisering.
    /// Ved suksess sendes en 6-sifret MFA-kode til brukerens epostadresse.
    /// Frontend navigerer til MFA-skjerm ved 200 OK.
    /// </summary>
    /// <param name="request">Email, Password og Device-info</param>
    /// <param name="ct"></param>
    /// <returns>200 OK (MFA-kode sendt), eller 400/401 ved feil</returns>
    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken ct = default)
    {
        var ipAddress = GetIpAddress();
    
        var result = await authService.LoginAsync(request, ipAddress, ct);
    
        if (result.IsFailure)
            return HandleFailure(result);
    
        return Ok();
    }
    
    /// <summary>
    /// Steg 2 av innlogging. Verifiserer den 6-sifrede MFA-koden sendt til brukerens epost.
    /// Ved suksess utstedes access token og refresh token, og innloggingshistorikk registreres.
    /// </summary>
    /// <param name="request">Email, MFA-kode og Device-info</param>
    /// <param name="ct"></param>
    /// <returns>200 OK med <see cref="LoginResponse"/> (tokens), eller 400/401 ved feil eller utløpt kode</returns> 
    [HttpPost("login/verify-mfa")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> VerifyMfa([FromBody] VerifyMfaRequest request, CancellationToken ct = default)
    {
        var ipAddress = GetIpAddress();
        var userAgent = Request.Headers.UserAgent.ToString();

        var result = await authService.VerifyMfaAsync(request, ipAddress, userAgent, ct);

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
