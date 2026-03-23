using AFBack.Common.Controllers;
using AFBack.Features.Auth.DTOs.Request;
using AFBack.Features.Auth.Services.Interfaces;
using AFBack.Infrastructure.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace AFBack.Features.Auth.Controllers;

/// <summary>
/// Endring av epost og telefonnummer for innloggede brukere,
/// samt "This wasn't me"-rapportering.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting(RateLimitPolicies.Auth)]
[Authorize]
public class VerificationController(IAccountVerificationService accountVerificationService) : BaseController
{
    // ======================== Epost verifisiering ======================== 
    /// <summary>
    /// Sender ny verifiseringsepost til en bruker som ikke har bekreftet eposten sin.
    /// Returnerer alltid 200 OK for å forhindre email enumeration.
    /// </summary>
    /// <param name="request"></param>
    /// <param name="ct"></param>
    /// <returns>200 Ok</returns>
    [HttpPost("resend-verification")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> ResendVerification([FromBody] EmailRequest request, CancellationToken ct = default)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        if (string.IsNullOrEmpty(ipAddress))
            return Problem(detail: "Unable to determine client IP address", 
                statusCode: StatusCodes.Status400BadRequest);
        
        var result = await accountVerificationService.ResendVerificationEmailAsync(request.Email, ipAddress, ct);
        
        if (result.IsFailure)
            return HandleFailure(result);
        
        return Ok();
    }
    
    /// <summary>
    /// Verifiserer brukerens epost med 6-sifret kode.
    /// </summary>
    [HttpPost("verify-email")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> VerifyEmail([FromBody] VerifyEmailRequest request, CancellationToken ct = default)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        if (string.IsNullOrEmpty(ipAddress))
            return Problem(detail: "Unable to determine client IP address", 
                statusCode: StatusCodes.Status400BadRequest);
        
        var result = await accountVerificationService.VerifyEmailAsync(request.Email, request.Code, ipAddress, ct);
    
        if (result.IsFailure)
            return HandleFailure(result);
    
        return Ok();
    }
    
    // ======================== SMS verifisering ======================== 
    
    /// <summary>
    /// Sender ny verifiserings-SMS til brukerens telefon.
    /// Returnerer alltid 200 OK for å forhindre phone enumeration.
    /// </summary>
    [HttpPost("resend-phone-verification")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> ResendPhoneVerification([FromBody] EmailRequest request,
        CancellationToken ct = default)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        if (string.IsNullOrEmpty(ipAddress))
            return Problem(detail: "Unable to determine client IP address",
                statusCode: StatusCodes.Status400BadRequest);

        var result = await accountVerificationService.ResendPhoneVerificationAsync(request.Email, ipAddress, ct);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok();
    }

    /// <summary>
    /// Verifiserer brukerens telefonnummer med 6-sifret kode.
    /// </summary>
    [HttpPost("verify-phone")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> VerifyPhone([FromBody] VerifyEmailRequest request, CancellationToken ct = default)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        if (string.IsNullOrEmpty(ipAddress))
            return Problem(detail: "Unable to determine client IP address",
                statusCode: StatusCodes.Status400BadRequest);

        var result = await accountVerificationService.VerifyPhoneAsync(request.Email, request.Code, ipAddress, ct);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok();
    }
}
