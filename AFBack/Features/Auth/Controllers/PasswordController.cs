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
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var userId = User.GetUserId(); 
    
        var result = await passwordService.ChangePasswordAsync(
            userId, request.CurrentPassword, request.NewPassword);
    
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
    public async Task<IActionResult> ForgotPassword([FromBody] EmailRequest request)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        if (string.IsNullOrEmpty(ipAddress))
            return Problem(detail: "Unable to determine client IP address", 
                statusCode: StatusCodes.Status400BadRequest);
    
        var result = await passwordService.ForgotPasswordAsync(request.Email, ipAddress);
    
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
        [FromBody] VerifyEmailRequest request)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        if (string.IsNullOrEmpty(ipAddress))
            return Problem(detail: "Unable to determine client IP address",
                statusCode: StatusCodes.Status400BadRequest);
        
        var result = await passwordService.VerifyPasswordResetEmailCodeAsync(
            request.Email, request.Code, ipAddress);
        
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
        [FromBody] EmailRequest request)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        if (string.IsNullOrEmpty(ipAddress))
            return Problem(detail: "Unable to determine client IP address",
                statusCode: StatusCodes.Status400BadRequest);
        
        var result = await passwordService.SendPasswordResetSmsAsync(
            request.Email, ipAddress);
        
        if (result.IsFailure)
            return HandleFailure(result);
        
        return Ok();
    }
    
    /// <summary>
    /// Steg 4: Validerer SMS-kode og setter nytt passord.
    /// </summary>
    [HttpPost("reset-password")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        if (string.IsNullOrEmpty(ipAddress))
            return Problem(detail: "Unable to determine client IP address", 
                statusCode: StatusCodes.Status400BadRequest);
        
        var result = await passwordService.ResetPasswordAsync(
            request.Email, request.Code, request.NewPassword, ipAddress);
    
        if (result.IsFailure)
            return HandleFailure(result);
    
        return Ok();
    }
}
