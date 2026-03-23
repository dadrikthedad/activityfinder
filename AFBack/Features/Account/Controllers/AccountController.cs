using AFBack.Common.Controllers;
using AFBack.Configurations.Options;
using AFBack.Features.Account.DTOs.Requests;
using AFBack.Features.Account.Services;
using AFBack.Features.FileHandling.DTOs.Requests;
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
[EnableRateLimiting(RateLimitPolicies.Auth)]
[Route("api/[controller]")]
[Authorize]
public class AccountController(IAccountChangeService accountChangeService) : BaseController
{
    
    // ======================== Bytte e-post (3 steg) ======================== 

    /// <summary>
    /// Steg 1: Starter epost-bytte. Krever passord.
    /// Sender verifiseringskode til den NYE epostadressen.
    /// </summary>
    /// <param name="request">ChangeEmailRequest med passord og ny email</param>
    /// <param name="ct"></param>
    /// <returns>Ok 200</returns>
    [HttpPost("request-email-change")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> RequestEmailChange([FromBody] ChangeEmailRequest request, 
        CancellationToken ct = default)
    {
        var userId = User.GetUserId(); 
        var ipAddress = GetIpAddress();
        
        var result = await accountChangeService.RequestEmailChangeAsync(
            userId, request.CurrentPassword, request.NewEmail, ipAddress, ct);
        
        if (result.IsFailure)
            return HandleFailure(result);
        
        return Ok();
    }

    /// <summary>
    /// Steg 2: Verifiserer koden sendt til nåværende epost.
    /// Ved suksess sendes verifiseringskode til den NYE epostadressen.
    /// </summary>
    /// <param name="request">VerifyCodeRequest med kode 6-sifret</param>
    /// <param name="ct"></param>
    /// <returns>Ok 200</returns>
    [HttpPost("verify-current-email-change")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> VerifyCurrentEmailForChange([FromBody] VerifyCodeRequest request,
        CancellationToken ct = default)
    {
        var userId = User.GetUserId(); 
        var ipAddress = GetIpAddress();
    
        var result = await accountChangeService.VerifyCurrentEmailForChangeAsync(userId, request.Code, ipAddress, ct);
    
        if (result.IsFailure)
            return HandleFailure(result);
    
        return Ok();
    }

    /// <summary>
    /// Steg 3: Verifiserer koden sendt til ny epost og oppdaterer epostadressen.
    /// </summary>
    /// <param name="request">VerifyCodeRequest med kode 6-sifret</param>
    /// <param name="ct"></param>
    /// <returns>Ok 200</returns>
    [HttpPost("verify-email-change")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> VerifyEmailChange([FromBody] VerifyCodeRequest request,
        CancellationToken ct = default)
    {
        var userId = User.GetUserId(); 
        var ipAddress = GetIpAddress();
        
        var result = await accountChangeService.VerifyEmailChangeAsync(userId, request.Code, ipAddress, ct);
        
        if (result.IsFailure)
            return HandleFailure(result);
        
        return Ok();
    }
    

    // ======================== Bytte telefonnummer (3 steg og innlogget) ======================== 

    /// <summary>
    /// Steg 1: Starter telefonnummer-bytte. Krever passord.
    /// Sender verifiseringskode + alert til brukerens NÅVÆRENDE epost.
    /// </summary>
    /// <param name="request">ChangePhoneRequest med passord og nytt nummer</param>
    /// <param name="ct"></param>
    /// <returns>Ok 200</returns>
    [HttpPost("request-phone-change")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> RequestPhoneChange([FromBody] ChangePhoneRequest request, 
        CancellationToken ct = default)
    {
        var userId = User.GetUserId(); 
        
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        if (string.IsNullOrEmpty(ipAddress))
            return Problem(detail: "Unable to determine client IP address",
                statusCode: StatusCodes.Status400BadRequest);
        
        var result = await accountChangeService.RequestPhoneChangeAsync(
            userId, request.CurrentPassword, request.NewPhoneNumber, ipAddress, ct);
        
        if (result.IsFailure)
            return HandleFailure(result);
        
        return Ok();
    }

    /// <summary>
    /// Steg 2: Verifiserer epost-koden for telefon-bytte.
    /// Ved suksess sendes SMS-kode til det NYE telefonnummeret.
    /// </summary>
    /// <param name="request">VerifyCodeRequest med kode 6-sifret</param>
    /// <param name="ct"></param>
    /// <returns>Ok 200</returns>
    [HttpPost("verify-current-email-phone-change")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> VerifyCurrentEmailForPhoneChange([FromBody] VerifyCodeRequest request,
        CancellationToken ct = default)
    {
        var userId = User.GetUserId(); 
        var ipAddress = GetIpAddress();
    
        var result = await accountChangeService.VerifyCurrentEmailForPhoneChangeAsync(userId, request.Code, 
            ipAddress, ct);
    
        if (result.IsFailure)
            return HandleFailure(result);
    
        return Ok();
    }

    /// <summary>
    /// Steg 3: Verifiserer SMS-koden sendt til nytt telefonnummer og oppdaterer nummeret.
    /// </summary>
    /// <param name="request">VerifyCodeRequest med kode 6-sifret</param>
    /// <param name="ct"></param>
    /// <returns>Ok 200</returns>
    [HttpPost("verify-phone-change")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> VerifyPhoneChange([FromBody] VerifyCodeRequest request, 
        CancellationToken ct = default)
    {
        var userId = User.GetUserId(); 
        var ipAddress = GetIpAddress();
        
        var result = await accountChangeService.VerifyPhoneChangeAsync(userId, request.Code, ipAddress, ct);
        
        if (result.IsFailure)
            return HandleFailure(result);
        
        return Ok();
    }
    
    // ======================== Bytte navn ======================== 

    /// <summary>
    /// Bytter FirstName og LastName til innlogget bruker
    /// </summary>
    /// <param name="request">ChangeNameRequest med navnene</param>
    /// <param name="ct"></param>
    /// <returns>Ok 200</returns>
    [HttpPut("name")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateName([FromBody] ChangeNameRequest request, CancellationToken ct = default)
    {
        var userId = User.GetUserId();
        var result = await accountChangeService.UpdateNameAsync(userId, request.FirstName, request.LastName, ct);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok();
    }
    
    // ======================== Bytte profilbilde ======================== 
    /// <summary>
    /// Bytter profilebilde for innlogget bruker
    /// </summary>
    /// <param name="request">ImageRequest med IFormFile </param>
    /// <param name="ct"></param>
    /// <returns>Ok 200</returns>
    [HttpPut("profileimage")]
    [RequestSizeLimit(ImageFileConfig.MaxSizeInBytes)] 
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateProfileImage([FromForm] ImageRequest request, CancellationToken ct = default)
    {
        var userId = User.GetUserId();
        var result = await accountChangeService.UpdateProfileImageAsync(userId, request.File, ct);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }
    
    // ======================== Fjerne profilbilde ======================== 
    /// <summary>
    /// Fjerner profilbildet for innlogget bruker
    /// </summary>
    [HttpDelete("profileimage")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> RemoveProfileImage(CancellationToken ct = default)
    {
        var userId = User.GetUserId();
        var result = await accountChangeService.RemoveProfileImageAsync(userId, ct);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok();
    }
}
