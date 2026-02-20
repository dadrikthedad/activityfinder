using AFBack.Common.Controllers;
using AFBack.Features.Auth.DTOs.Request;
using AFBack.Features.Auth.DTOs.Response;
using AFBack.Features.Auth.Services;
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
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        if (string.IsNullOrEmpty(ipAddress))
            return Problem(detail: "Unable to determine client IP address", 
                statusCode: StatusCodes.Status400BadRequest);
        
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
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        if (string.IsNullOrEmpty(ipAddress))
            return Problem(detail: "Unable to determine client IP address",
                statusCode: StatusCodes.Status400BadRequest);
    
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
    
    // ======================== Epost verifisiering ======================== 
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
    
    // ======================== Glemt passord ======================== 
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
        
        var result = await authService.VerifyPasswordResetEmailCodeAsync(
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
        
        var result = await authService.SendPasswordResetSmsAsync(
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
        
        var result = await authService.ResetPasswordAsync(
            request.Email, request.Code, request.NewPassword, ipAddress);
    
        if (result.IsFailure)
            return HandleFailure(result);
    
        return Ok();
    }
    
    // ======================== Innloggede endepunkter ========================
    
    
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
    
        var result = await authService.ChangePasswordAsync(
            userId, request.CurrentPassword, request.NewPassword);
    
        if (result.IsFailure)
            return HandleFailure(result);
    
        return Ok();
    }
    
    // ======================== Bytte e-post (innlogget) ======================== 

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
        
        var result = await authService.RequestEmailChangeAsync(
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
    
        var result = await authService.VerifyCurrentEmailForChangeAsync(userId, request.Code, ipAddress);
    
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
        
        var result = await authService.VerifyEmailChangeAsync(userId, request.Code, ipAddress);
        
        if (result.IsFailure)
            return HandleFailure(result);
        
        return Ok();
    }

    // ======================== Bytte telefonnummer (innlogget) ======================== 

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
        
        var result = await authService.RequestPhoneChangeAsync(
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
    
        var result = await authService.VerifyCurrentEmailForPhoneChangeAsync(userId, request.Code, ipAddress);
    
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
        
        var result = await authService.VerifyPhoneChangeAsync(userId, request.Code, ipAddress);
        
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
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        if (string.IsNullOrEmpty(ipAddress))
            return Problem(detail: "Unable to determine client IP address",
                statusCode: StatusCodes.Status400BadRequest);
    
        var result = await authService.ReportUnauthorizedChangeAsync(token, ipAddress);
    
        if (result.IsFailure)
            return HandleFailure(result);
    
        return Ok();
    }
}
