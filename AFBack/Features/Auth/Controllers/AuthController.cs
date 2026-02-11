using AFBack.Controllers;
using AFBack.Features.Auth.DTOs.Request;
using AFBack.Features.Auth.DTOs.Response;
using AFBack.Features.Auth.Services;
using AFBack.Infrastructure.Constants;
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
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        if (string.IsNullOrEmpty(ipAddress))
            return Problem(detail: "Unable to determine client IP address", 
                statusCode: StatusCodes.Status400BadRequest);
        
        var result = await authService.SignupAsync(request, ipAddress);
        
        if (result.IsFailure)
            return HandleFailure(result);

        return CreatedAtAction(nameof(SignUp), new { id = result.Value!.UserId }, result.Value);
    }
    
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var result = await authService.LoginAsync(request);
        
        if (result.IsFailure)
            return HandleFailure(result);
      
        return Ok(result.Data);
    }

    /// <summary>
    /// Sender ny verifiseringsepost til en bruker som ikke har bekreftet eposten sin.
    /// Returnerer alltid 200 OK for å forhindre email enumeration.
    /// </summary>
    /// <param name="request"></param>
    /// <returns>200 Ok</returns>
    [HttpPost("resend-verification")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> ResendVerification([FromBody] EmailRequest request)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        if (string.IsNullOrEmpty(ipAddress))
            return Problem(detail: "Unable to determine client IP address", 
                statusCode: StatusCodes.Status400BadRequest);
        
        var result = await authService.ResendVerificationEmailAsync(request.Email, ipAddress);
        
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
    public async Task<IActionResult> VerifyEmail([FromBody] VerifyEmailRequest request)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        if (string.IsNullOrEmpty(ipAddress))
            return Problem(detail: "Unable to determine client IP address", 
                statusCode: StatusCodes.Status400BadRequest);
        
        var result = await authService.VerifyEmailAsync(request.Email, request.Code, ipAddress);
    
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
    
        var result = await authService.ForgotPasswordAsync(request.Email, ipAddress);
    
        if (result.IsFailure)
            return HandleFailure(result);
    
        return Ok();
    }
    
    /// <summary>
    /// Setter nytt passord med 6-sifret reset-kode.
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
        
        var result = await authService.ResetPasswordAsync(request.Email, request.Code, 
            request.NewPassword, ipAddress);
    
        if (result.IsFailure)
            return HandleFailure(result);
    
        return Ok();
    }
    
    /// <summary>
    /// Sender ny verifiserings-SMS til brukerens telefon.
    /// Returnerer alltid 200 OK for å forhindre phone enumeration.
    /// </summary>
    [HttpPost("resend-phone-verification")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> ResendPhoneVerification([FromBody] ResendPhoneVerificationRequest request)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        if (string.IsNullOrEmpty(ipAddress))
            return Problem(detail: "Unable to determine client IP address",
                statusCode: StatusCodes.Status400BadRequest);

        var result = await authService.ResendPhoneVerificationAsync(request.PhoneNumber, ipAddress);

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
    public async Task<IActionResult> VerifyPhone([FromBody] VerifyPhoneRequest request)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        if (string.IsNullOrEmpty(ipAddress))
            return Problem(detail: "Unable to determine client IP address",
                statusCode: StatusCodes.Status400BadRequest);

        var result = await authService.VerifyPhoneAsync(request.PhoneNumber, request.Code, ipAddress);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok();
    }
}
