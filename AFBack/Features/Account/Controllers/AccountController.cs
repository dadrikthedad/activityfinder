using AFBack.Common.Controllers;
using AFBack.Features.Account.DTOs.Requests;
using AFBack.Features.Account.Services;
using AFBack.Infrastructure.Constants;
using AFBack.Infrastructure.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace AFBack.Features.Account.Controllers;

/// <summary>
/// Endring av epost og telefonnummer for innloggede brukere,
/// samt "This wasn't me"-rapportering.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AccountController(IAccountChangeService accountChangeService) : BaseController
{
    
    // ======================== Bytte e-post (3 steg) ======================== 

    /// <summary>
    /// Steg 1: Starter epost-bytte. Krever passord.
    /// Sender verifiseringskode til den NYE epostadressen.
    /// </summary>
    [HttpPost("request-email-change")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> RequestEmailChange([FromBody] ChangeEmailRequest request)
    {
        var userId = User.GetUserId(); 
        
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        if (string.IsNullOrEmpty(ipAddress))
            return Problem(detail: "Unable to determine client IP address",
                statusCode: StatusCodes.Status400BadRequest);
        
        var result = await accountChangeService.RequestEmailChangeAsync(
            userId, request.CurrentPassword, request.NewEmail, ipAddress);
        
        if (result.IsFailure)
            return HandleFailure(result);
        
        return Ok();
    }
    
    /// <summary>
    /// Steg 2: Verifiserer koden sendt til nåværende epost.
    /// Ved suksess sendes verifiseringskode til den NYE epostadressen.
    /// </summary>
    [HttpPost("verify-current-email-change")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> VerifyCurrentEmailForChange([FromBody] VerifyCodeRequest request)
    {
        var userId = User.GetUserId(); 
    
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        if (string.IsNullOrEmpty(ipAddress))
            return Problem(detail: "Unable to determine client IP address",
                statusCode: StatusCodes.Status400BadRequest);
    
        var result = await accountChangeService.VerifyCurrentEmailForChangeAsync(userId, request.Code, ipAddress);
    
        if (result.IsFailure)
            return HandleFailure(result);
    
        return Ok();
    }

    /// <summary>
    /// Steg 3: Verifiserer koden sendt til ny epost og oppdaterer epostadressen.
    /// </summary>
    [HttpPost("verify-email-change")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> VerifyEmailChange([FromBody] VerifyCodeRequest request)
    {
        var userId = User.GetUserId(); 
        
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        if (string.IsNullOrEmpty(ipAddress))
            return Problem(detail: "Unable to determine client IP address",
                statusCode: StatusCodes.Status400BadRequest);
        
        var result = await accountChangeService.VerifyEmailChangeAsync(userId, request.Code, ipAddress);
        
        if (result.IsFailure)
            return HandleFailure(result);
        
        return Ok();
    }
    

    // ======================== Bytte telefonnummer (3 steg og innlogget) ======================== 

    /// <summary>
    /// Steg 1: Starter telefonnummer-bytte. Krever passord.
    /// Sender verifiseringskode + alert til brukerens NÅVÆRENDE epost.
    /// </summary>
    [HttpPost("request-phone-change")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> RequestPhoneChange([FromBody] ChangePhoneRequest request)
    {
        var userId = User.GetUserId(); 
        
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        if (string.IsNullOrEmpty(ipAddress))
            return Problem(detail: "Unable to determine client IP address",
                statusCode: StatusCodes.Status400BadRequest);
        
        var result = await accountChangeService.RequestPhoneChangeAsync(
            userId, request.CurrentPassword, request.NewPhoneNumber, ipAddress);
        
        if (result.IsFailure)
            return HandleFailure(result);
        
        return Ok();
    }
    
    /// <summary>
    /// Steg 2: Verifiserer epost-koden for telefon-bytte.
    /// Ved suksess sendes SMS-kode til det NYE telefonnummeret.
    /// </summary>
    [HttpPost("verify-current-email-phone-change")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> VerifyCurrentEmailForPhoneChange([FromBody] VerifyCodeRequest request)
    {
        var userId = User.GetUserId(); 
    
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        if (string.IsNullOrEmpty(ipAddress))
            return Problem(detail: "Unable to determine client IP address",
                statusCode: StatusCodes.Status400BadRequest);
    
        var result = await accountChangeService.VerifyCurrentEmailForPhoneChangeAsync(userId, request.Code, 
            ipAddress);
    
        if (result.IsFailure)
            return HandleFailure(result);
    
        return Ok();
    }

    /// <summary>
    /// Steg 3: Verifiserer SMS-koden sendt til nytt telefonnummer og oppdaterer nummeret.
    /// </summary>
    [HttpPost("verify-phone-change")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> VerifyPhoneChange([FromBody] VerifyCodeRequest request)
    {
        var userId = User.GetUserId(); 
        
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        if (string.IsNullOrEmpty(ipAddress))
            return Problem(detail: "Unable to determine client IP address",
                statusCode: StatusCodes.Status400BadRequest);
        
        var result = await accountChangeService.VerifyPhoneChangeAsync(userId, request.Code, ipAddress);
        
        if (result.IsFailure)
            return HandleFailure(result);
        
        return Ok();
    }
    
    // ======================== Bytte navn ======================== 
    
    [HttpPut("name")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ChangeName([FromBody] ChangeNameRequest request)
    {
        var userId = User.GetUserId();
        var result = await accountService.ChangeNameAsync(userId, request.FirstName, request.LastName);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok();
    }
    
    // ======================== Bytte profilbilde ======================== 
}
