using System.Security.Cryptography;
using AFBack.Data;
using AFBack.DTOs.Email;
using AFBack.Extensions;
using AFBack.Models;
using AFBack.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EmailController : BaseController
{
    private readonly EmailService _emailService;
    private readonly UserService _userService;
    private readonly EmailRateLimitService _emailRateLimitService;
    private readonly ILogger<EmailController> _logger;
    private readonly ApplicationDbContext _context;
    private readonly IpBanService _ipBanService;

    public EmailController(
        EmailService emailService, 
        UserService userService, 
        EmailRateLimitService emailRateLimitService,
        ILogger<EmailController> logger, 
        ApplicationDbContext context,
        IpBanService ipBanService)
    {
        _context = context;
        _emailService = emailService;
        _userService = userService;
        _emailRateLimitService = emailRateLimitService;
        _logger = logger;
        _ipBanService = ipBanService;
    }

    [HttpPost("verify")]
    public async Task<IActionResult> VerifyEmail([FromBody] VerifyEmailRequest request)
    {
        try
        {
            // Hent brukeren FØR vi nuller token
            var user = await _userService.GetUserByTokenAsync(request.Token);
            
            if (user == null)
            {
                return BadRequest(new { message = "Invalid or expired verification code", success = false });
            }

            // Nå kan vi trygt verifisere (som nuller token)
            var isValid = await _userService.VerifyEmailTokenAsync(request.Token);

            if (isValid)
            {
                // Fjern rate limit for denne email adressen når den blir verifisert
                _emailRateLimitService.ClearEmailAttempts(user.Email);
                
                // Send velkomstepost
                await _emailService.SendWelcomeEmailAsync(user.Email, user.FullName);

                return Ok(new { message = "Email verified!", success = true });
            }

            return BadRequest(new { message = "Invalid or expired verification code", success = false });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in VerifyEmail for token {Token}", request.Token);
            return StatusCode(500, new { message = "Network error" });
        }
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        try
        {
            // *** IP-BAN SJEKK MED EXTENSION ***
            var ipCheckResult = await this.CheckAuthEndpointAsync(_ipBanService, _logger, "ForgotPassword", request.Email);
            if (ipCheckResult.IsBanned)
                return ipCheckResult.ActionResult!;

            // Validér email input
            if (string.IsNullOrWhiteSpace(request.Email))
            {
                await this.ReportSuspiciousActivityAsync(
                    _ipBanService,
                    SuspiciousActivityTypes.API_ABUSE,
                    "Forgot password with empty email",
                    _logger);
                    
                return BadRequest(new { message = "Email is required." });
            }

            var normalizedEmail = request.Email.Trim().ToLowerInvariant();

            // Validér email format
            if (!IpBanExtensions.IsValidEmail(normalizedEmail))
            {
                await this.ReportSuspiciousActivityAsync(
                    _ipBanService,
                    SuspiciousActivityTypes.API_ABUSE,
                    $"Invalid email format in forgot password: {normalizedEmail}",
                    _logger);
                    
                return BadRequest(new { message = "Invalid email format." });
            }

            // *** RATE LIMITING (bruk IP fra extension) ***
            var clientIp = ipCheckResult.ClientIp;
            var (isAllowed, retryAfter) = await _emailRateLimitService.CanSendVerificationEmailAsync(normalizedEmail, clientIp);

            if (!isAllowed)
            {
                await this.ReportSuspiciousActivityAsync(
                    _ipBanService,
                    SuspiciousActivityTypes.EXCESSIVE_PASSWORD_RESET,
                    $"Rate limit exceeded for password reset to: {normalizedEmail}",
                    _logger);

                if (retryAfter.HasValue)
                {
                    var message = retryAfter.Value.TotalHours >= 1 
                        ? $"Daily limit reached. Try again in {Math.Ceiling(retryAfter.Value.TotalHours)} hours."
                        : $"Please wait {Math.Ceiling(retryAfter.Value.TotalMinutes)} minutes before requesting another email.";
            
                    return BadRequest(new { 
                        message,
                        retryAfter = retryAfter.Value.TotalSeconds 
                    });
                }
                else
                {
                    return BadRequest(new { 
                        message = "Daily email limit reached. Please try again tomorrow." 
                    });
                }
            }

            // Opprett både reset token og kode
            var resetData = await _userService.CreatePasswordResetTokenAsync(normalizedEmail);

            if (resetData.HasValue)
            {
                var (token, code) = resetData.Value;
                
                // Send epost med både link og kode
                var success = await _emailService.SendPasswordResetEmailAsync(normalizedEmail, token, code);

                if (success)
                {
                    // Registrer at email faktisk ble sendt (for rate limiting)
                    _emailRateLimitService.RegisterVerificationEmailSent(normalizedEmail);
                    
                    _logger.LogInformation("Password reset email with token and code sent successfully to {Email}", normalizedEmail);
                }
                else
                {
                    await this.ReportSuspiciousActivityAsync(
                        _ipBanService,
                        SuspiciousActivityTypes.VERIFICATION_EMAIL_FAILED,
                        $"Failed to send password reset email to: {normalizedEmail}",
                        _logger);
                        
                    _logger.LogWarning("Failed to send password reset email to {Email}", normalizedEmail);
                    // Ikke avslør tekniske detaljer
                }
            }
            else
            {
                // Rapporter forsøk på password reset for ikke-eksisterende bruker
                await this.ReportSuspiciousActivityAsync(
                    _ipBanService,
                    SuspiciousActivityTypes.API_ABUSE,
                    $"Password reset requested for non-existent email: {normalizedEmail}",
                    _logger);
            }

            // Returner alltid samme melding for sikkerhet (ikke avslør om eposten eksisterer)
            return Ok(new
            {
                message = "If the email address is registered, you will receive password reset instructions with both a link and a code",
                success = true
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in ForgotPassword for {Email}", request.Email);
            
            await this.ReportSuspiciousActivityAsync(
                _ipBanService,
                SuspiciousActivityTypes.API_ABUSE,
                $"Exception in forgot password for {request.Email}: {ex.Message}",
                _logger);
                
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        try
        {
            // Valider token/kode først
            var isValid = await _userService.ValidatePasswordResetTokenAsync(request.TokenOrCode);

            if (!isValid)
            {
                return BadRequest(new { message = "Invalid or expired reset token or code", success = false });
            }

            // Reset passordet
            var success = await _userService.ResetPasswordAsync(request.TokenOrCode, request.NewPassword);

            if (success)
            {
                return Ok(new { message = "Password has been updated!", success = true });
            }

            return BadRequest(new { message = "Could not update password", success = false });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in ResetPassword");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpGet("validate-reset-token/{tokenOrCode}")]
    public async Task<IActionResult> ValidateResetToken(string tokenOrCode)
    {
        try
        {
            var isValid = await _userService.ValidatePasswordResetTokenAsync(tokenOrCode);
            return Ok(new { isValid = isValid });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in ValidateResetToken");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpPost("resend-verification")]
    public async Task<IActionResult> ResendVerificationEmail([FromBody] ResendVerificationRequest request)
    {
        // *** IP-BAN SJEKK MED EXTENSION ***
        var ipCheckResult = await this.CheckAuthEndpointAsync(_ipBanService, _logger, "ResendVerification", request.Email);
        if (ipCheckResult.IsBanned)
            return ipCheckResult.ActionResult!;

        if (string.IsNullOrWhiteSpace(request.Email))
        {
            await this.ReportSuspiciousActivityAsync(
                _ipBanService,
                SuspiciousActivityTypes.API_ABUSE,
                "Resend verification with empty email",
                _logger);
                
            return BadRequest(new { message = "Email is required." });
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        // Validér email format
        if (!IpBanExtensions.IsValidEmail(normalizedEmail))
        {
            await this.ReportSuspiciousActivityAsync(
                _ipBanService,
                SuspiciousActivityTypes.API_ABUSE,
                $"Invalid email format in resend verification: {normalizedEmail}",
                _logger);
                
            return BadRequest(new { message = "Invalid email format." });
        }

        try
        {
            // *** RATE LIMITING (bruker IP fra extension) ***
            var clientIp = ipCheckResult.ClientIp;
            var (isAllowed, retryAfter) = await _emailRateLimitService.CanSendVerificationEmailAsync(normalizedEmail, clientIp);

            if (!isAllowed)
            {
                await this.ReportSuspiciousActivityAsync(
                    _ipBanService,
                    SuspiciousActivityTypes.EXCESSIVE_EMAIL_VERIFICATION,
                    $"Rate limit exceeded for resend verification to: {normalizedEmail}",
                    _logger);

                if (retryAfter.HasValue)
                {
                    var message = retryAfter.Value.TotalHours >= 1 
                        ? $"Daily limit reached. Try again in {Math.Ceiling(retryAfter.Value.TotalHours)} hours."
                        : $"Please wait {Math.Ceiling(retryAfter.Value.TotalMinutes)} minutes before requesting another email.";
            
                    return BadRequest(new { 
                        message,
                        retryAfter = retryAfter.Value.TotalSeconds 
                    });
                }
                else
                {
                    return BadRequest(new { 
                        message = "Daily email limit reached. Please try again tomorrow." 
                    });
                }
            }

            var user = await _context.Users
                .Include(u => u.VerificationInfo)
                .FirstOrDefaultAsync(u => u.Email == normalizedEmail);

            if (user == null)
            {
                await this.ReportSuspiciousActivityAsync(
                    _ipBanService,
                    SuspiciousActivityTypes.API_ABUSE,
                    $"Resend verification requested for non-existent email: {normalizedEmail}",
                    _logger);

                _logger.LogInformation("Resend verification requested for non-existent email: {Email}", normalizedEmail);
                return Ok(new { message = "If an account exists for this email, a new verification link has been sent." });
            }

            if (user.EmailConfirmed)
            {
                // Fjern rate limits for allerede verifiserte emails
                _emailRateLimitService.ClearEmailAttempts(normalizedEmail);
                
                _logger.LogInformation("Resend verification requested for already verified email: {Email}", normalizedEmail);
                return Ok(new
                {
                    message = "Your email is already verified. You can log in.",
                    alreadyVerified = true
                });
            }

            // Generer nye tokens
            var newToken = Guid.NewGuid().ToString();
            var newCode = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();

            // Opprett/oppdater VerificationInfo
            if (user.VerificationInfo == null)
            {
                user.VerificationInfo = new VerificationInfo
                {
                    User = user,
                    EmailConfirmationToken = newToken,
                    EmailConfirmationCode = newCode,
                    EmailConfirmationTokenExpires = DateTime.UtcNow.AddHours(1)
                };
            }
            else
            {
                user.VerificationInfo.EmailConfirmationToken = newToken;
                user.VerificationInfo.EmailConfirmationCode = newCode;
                user.VerificationInfo.EmailConfirmationTokenExpires = DateTime.UtcNow.AddHours(1);
            }

            // Lagre tokens før sending slik at lenke/kode er gyldig umiddelbart
            await _context.SaveChangesAsync();

            // Send email
            var emailSent = await _emailService.SendVerificationEmailAsync(user.Email, newToken, newCode);

            if (emailSent)
            {
                // Registrer at email faktisk ble sendt (for rate limiting)
                _emailRateLimitService.RegisterVerificationEmailSent(user.Email);
                
                // Oppdater timestamp ETTER vellykket sending
                await _userService.MarkVerificationEmailSentAsync(user.Email);

                _logger.LogInformation("Verification email resent successfully to {Email}", user.Email);
                return Ok(new
                {
                    message = "A new verification email has been sent with both web link and mobile code. Please check your inbox.",
                    emailSent = true
                });
            }
            else
            {
                await this.ReportSuspiciousActivityAsync(
                    _ipBanService,
                    SuspiciousActivityTypes.VERIFICATION_EMAIL_FAILED,
                    $"Failed to resend verification email to: {user.Email}",
                    _logger);

                _logger.LogWarning("Failed to resend verification email to {Email}", user.Email);
                return Ok(new { message = "If an account exists for this email, a new verification link has been sent." });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error resending verification email to {Email}", normalizedEmail);
            
            await this.ReportSuspiciousActivityAsync(
                _ipBanService,
                SuspiciousActivityTypes.API_ABUSE,
                $"Exception in resend verification for {normalizedEmail}: {ex.Message}",
                _logger);
                
            return Ok(new { message = "If an account exists for this email, a new verification link has been sent." });
        }
    }
}