using System.Security.Cryptography;
using AFBack.Data;
using AFBack.DTOs.Email;
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

    public EmailController(
        EmailService emailService, 
        UserService userService, 
        EmailRateLimitService emailRateLimitService,
        ILogger<EmailController> logger, 
        ApplicationDbContext context)
    {
        _context = context;
        _emailService = emailService;
        _userService = userService;
        _emailRateLimitService = emailRateLimitService;
        _logger = logger;
    }

    [HttpPost("send-verification")]
    public async Task<IActionResult> SendVerificationEmail([FromBody] SendVerificationRequest request)
    {
        try
        {
            // *** RATE LIMITING ***
            var clientIp = Request.HttpContext.Connection.RemoteIpAddress?.ToString();
            var (isAllowed, retryAfter) = await _emailRateLimitService.CanSendVerificationEmailAsync(request.Email, clientIp);

            if (!isAllowed)
            {
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

            // *** OPPRETT HYBRID VERIFIKASJON TOKENS ***
            var (longToken, shortCode) = await _userService.CreateVerificationTokenAsync(request.Email);

            if (longToken == null || shortCode == null)
            {
                // Brukeren finnes ikke, men ikke avslør dette
                return Ok(new { message = "If the email exists, a verification email has been sent.", success = true });
            }

            // *** SEND EPOST MED BEGGE TOKENS ***
            var success = await _emailService.SendVerificationEmailAsync(request.Email, longToken, shortCode);

            if (success)
            {
                // Registrer at email faktisk ble sendt (for rate limiting)
                _emailRateLimitService.RegisterVerificationEmailSent(request.Email);
                
                await _userService.MarkVerificationEmailSentAsync(request.Email);
                
                return Ok(new
                {
                    message = "Verification email sent with both web link and mobile code. Check your inbox!",
                    success = true,
                    verificationMethods = new
                    {
                        webLink = "Click the verification link in the email",
                        mobileCode = "Enter the 6-digit code from the email into the app",
                        deepLink = "Click 'Open in App' if using mobile"
                    }
                });
            }

            return BadRequest(new { message = "Could not send verification email", success = false });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in SendVerificationEmail for {Email}", request.Email);
            return StatusCode(500, new { message = "Internal server error" });
        }
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
            // *** RATE LIMITING - bruk samme system for password reset ***
            var clientIp = Request.HttpContext.Connection.RemoteIpAddress?.ToString();
            var (isAllowed, retryAfter) = await _emailRateLimitService.CanSendVerificationEmailAsync(request.Email, clientIp);

            if (!isAllowed)
            {
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

            // Opprett reset token
            var token = await _userService.CreatePasswordResetTokenAsync(request.Email);

            if (token != null)
            {
                // Send epost
                var success = await _emailService.SendForgotPasswordEmailAsync(request.Email, token);

                if (success)
                {
                    // Registrer at email faktisk ble sendt (for rate limiting)
                    _emailRateLimitService.RegisterVerificationEmailSent(request.Email);
                }
                else
                {
                    _logger.LogWarning("Failed to send password reset email to {Email}", request.Email);
                    // Ikke avslør tekniske detaljer
                }
            }

            // Returner alltid samme melding for sikkerhet (ikke avslør om eposten eksisterer)
            return Ok(new
            {
                message = "If the email address is registered, you will receive a password reset link",
                success = true
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in ForgotPassword for {Email}", request.Email);
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        try
        {
            // Valider token først
            var isValidToken = await _userService.ValidatePasswordResetTokenAsync(request.Token);

            if (!isValidToken)
            {
                return BadRequest(new { message = "Invalid or expired reset token", success = false });
            }

            // Reset passordet
            var success = await _userService.ResetPasswordAsync(request.Token, request.NewPassword);

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

    [HttpGet("validate-reset-token/{token}")]
    public async Task<IActionResult> ValidateResetToken(string token)
    {
        try
        {
            var isValid = await _userService.ValidatePasswordResetTokenAsync(token);
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
        if (string.IsNullOrWhiteSpace(request.Email))
            return BadRequest(new { message = "Email is required." });

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        try
        {
            // *** RATE LIMITING ***
            var clientIp = Request.HttpContext.Connection.RemoteIpAddress?.ToString();
            var (isAllowed, retryAfter) = await _emailRateLimitService.CanSendVerificationEmailAsync(normalizedEmail, clientIp);

            if (!isAllowed)
            {
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
                    EmailConfirmationCode = newCode
                };
            }
            else
            {
                user.VerificationInfo.EmailConfirmationToken = newToken;
                user.VerificationInfo.EmailConfirmationCode = newCode;
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
                _logger.LogWarning("Failed to resend verification email to {Email}", user.Email);
                return Ok(new { message = "If an account exists for this email, a new verification link has been sent." });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error resending verification email to {Email}", normalizedEmail);
            return Ok(new { message = "If an account exists for this email, a new verification link has been sent." });
        }
    }
}