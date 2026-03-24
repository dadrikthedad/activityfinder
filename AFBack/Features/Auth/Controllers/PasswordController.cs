using AFBack.Common.Controllers;
using AFBack.Features.Auth.DTOs.Request;
using AFBack.Features.Auth.Services.Interfaces;
using AFBack.Infrastructure.Constants;
using AFBack.Infrastructure.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace AFBack.Features.Auth.Controllers;

/// <summary>
/// Glemt passord-flyten (4 steg: epost-kode → verifiser → SMS-kode → reset passord).
/// </summary>
[ApiController]
[Route("api/password-reset")]
[EnableRateLimiting(RateLimitPolicies.Auth)]
[AllowAnonymous]
public class PasswordController(IPasswordService passwordService) : BaseController
{
    
    // ======================== Bytt Passord  ======================== 
    
    /// <summary>
    /// Bytter passord for innlogget bruker.
    /// Krever at brukeren oppgir riktig nåværende passord.
    /// </summary>
    [HttpPost("change-password")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request,
        CancellationToken ct = default)
    {
        var userId = User.GetUserId(); 
    
        var result = await passwordService.ChangePasswordAsync(
            userId, request.CurrentPassword, request.NewPassword, ct);
    
        if (result.IsFailure)
            return HandleFailure(result);
    
        return Ok();
    }

    
    /// <summary>
    /// Sender passord-reset epost. Returnerer alltid 200 OK for å forhindre email enumeration.
    /// </summary>
    [HttpPost("forgot-password")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> ForgotPassword([FromBody] EmailRequest request, CancellationToken ct = default)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        if (string.IsNullOrEmpty(ipAddress))
            return Problem(detail: "Unable to determine client IP address", 
                statusCode: StatusCodes.Status400BadRequest);
    
        var result = await passwordService.ForgotPasswordAsync(request.Email, ipAddress, ct);
    
        if (result.IsFailure)
            return HandleFailure(result);
    
        return Ok();
    }
    
    /// <summary>
    /// Steg 2: Verifiserer epost-reset-koden.
    /// Ved suksess kan brukeren be om SMS-kode i neste steg.
    /// </summary>
    [HttpPost("verify-password-reset-email")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> VerifyPasswordResetEmailCode(
        [FromBody] VerifyEmailRequest request, CancellationToken ct = default)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        if (string.IsNullOrEmpty(ipAddress))
            return Problem(detail: "Unable to determine client IP address",
                statusCode: StatusCodes.Status400BadRequest);
        
        var result = await passwordService.VerifyPasswordResetEmailCodeAsync(
            request.Email, request.Code, ipAddress, ct);
        
        if (result.IsFailure)
            return HandleFailure(result);
        
        return Ok();
    }
    
    /// <summary>
    /// Steg 3: Sender SMS-kode for passord-reset.
    /// Krever at epost-kode er verifisert (steg 2).
    /// Validerer at oppgitt telefonnummer matcher brukerens registrerte nummer.
    /// </summary>
    [HttpPost("send-password-reset-sms")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> SendPasswordResetSms(
        [FromBody] EmailRequest request, CancellationToken ct = default)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        if (string.IsNullOrEmpty(ipAddress))
            return Problem(detail: "Unable to determine client IP address",
                statusCode: StatusCodes.Status400BadRequest);
        
        var result = await passwordService.SendPasswordResetSmsAsync(
            request.Email, ipAddress, ct);
        
        if (result.IsFailure)
            return HandleFailure(result);
        
        return Ok();
    }
    
    /// <summary>
    /// Steg 3b: Validerer SMS-koden for passord-reset.
    /// Ved suksess er brukeren klar til å sette nytt passord i steg 4.
    /// </summary>
    [HttpPost("verify-password-reset-sms")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> VerifyPasswordResetSms(
        [FromBody] VerifyEmailRequest request, CancellationToken ct = default)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        if (string.IsNullOrEmpty(ipAddress))
            return Problem(detail: "Unable to determine client IP address",
                statusCode: StatusCodes.Status400BadRequest);

        var result = await passwordService.VerifyPasswordResetSmsAsync(request.Email, request.Code, ipAddress, ct);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok();
    }

    /// <summary>
    /// Steg 4: Setter nytt passord. Krever at SMS-koden er verifisert i steg 3b.
    /// </summary>
    [HttpPost("reset-password")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request,
        CancellationToken ct = default)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        if (string.IsNullOrEmpty(ipAddress))
            return Problem(detail: "Unable to determine client IP address", 
                statusCode: StatusCodes.Status400BadRequest);

        var result = await passwordService.ResetPasswordAsync(request.Email, request.NewPassword, ipAddress, ct);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok();
    }
}
