using System.Security.Cryptography;
using AFBack.Data;
using AFBack.DTOs.Email;
using AFBack.Extensions;
using AFBack.Features.Cache;
using AFBack.Features.Cache.Interface;
using AFBack.Infrastructure.Security.Services;
using AFBack.Infrastructure.Services;
using AFBack.Models;
using AFBack.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EmailController(
    EmailService emailService,
    UserService userService,
    EmailRateLimitService emailRateLimitService,
    ILogger<EmailController> logger,
    AppDbContext context,
    IIpBanService ipBanService,
    IUserCache userCache,
    ResponseService responseService)
    : BaseController<EmailController>(context, logger, userCache, responseService)
{
    [HttpPost("verify")]
    public async Task<IActionResult> VerifyEmail([FromBody] VerifyEmailRequest request)
    {
        try
        {
            // Hent brukeren FØR vi nuller token
            var user = await userService.GetUserByTokenAsync(request.Token);
            
            if (user == null)
            {
                return BadRequest(new { message = "Invalid or expired verification code", success = false });
            }

            // Nå kan vi trygt verifisere (som nuller token)
            var isValid = await userService.VerifyEmailTokenAsync(request.Token);

            if (isValid)
            {
                // Fjern rate limit for denne email adressen når den blir verifisert
                emailRateLimitService.ClearEmailAttempts(user.Email);
                
                // Send velkomstepost
                await emailService.SendWelcomeEmailAsync(user.Email, user.FullName);

                return Ok(new { message = "Email verified!", success = true });
            }

            return BadRequest(new { message = "Invalid or expired verification code", success = false });
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error in VerifyEmail for token {Token}", request.Token);
            return StatusCode(500, new { message = "Network error" });
        }
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        try
        {
            // Validér email input
            if (string.IsNullOrWhiteSpace(request.Email))
            {
                await this.ReportSuspiciousActivityAsync(
                    ipBanService,
                    SuspiciousActivityTypes.API_ABUSE,
                    "Forgot password with empty email",
                    Logger);
                    
                return BadRequest(new { message = "Email is required." });
            }

            var normalizedEmail = request.Email.Trim().ToLowerInvariant();

            // Validér email format
            if (!IpBanExtensions.IsValidEmail(normalizedEmail))
            {
                await this.ReportSuspiciousActivityAsync(
                    ipBanService,
                    SuspiciousActivityTypes.API_ABUSE,
                    $"Invalid email format in forgot password: {normalizedEmail}",
                    Logger);
                    
                return BadRequest(new { message = "Invalid email format." });
            }

            // Rate limiting - hent IP direkte
            var clientIp = HttpContext.GetClientIpAddress(); // ⬅️ Bruk extension method
            var (isAllowed, retryAfter) = await emailRateLimitService.CanSendVerificationEmailAsync(normalizedEmail, clientIp);

            if (!isAllowed)
            {
                await this.ReportSuspiciousActivityAsync(
                    ipBanService,
                    SuspiciousActivityTypes.EXCESSIVE_PASSWORD_RESET,
                    $"Rate limit exceeded for password reset to: {normalizedEmail}",
                    Logger);

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
                
                return BadRequest(new { 
                    message = "Daily email limit reached. Please try again tomorrow." 
                });
            }

            // Opprett reset token og kode
            var resetData = await userService.CreatePasswordResetTokenAsync(normalizedEmail);

            if (resetData.HasValue)
            {
                var (token, code) = resetData.Value;
                var success = await emailService.SendPasswordResetEmailAsync(normalizedEmail, token, code);

                if (success)
                {
                    emailRateLimitService.RegisterVerificationEmailSent(normalizedEmail);
                    Logger.LogInformation("Password reset email sent to {Email}", normalizedEmail);
                }
                else
                {
                    await this.ReportSuspiciousActivityAsync(
                        ipBanService,
                        SuspiciousActivityTypes.VERIFICATION_EMAIL_FAILED,
                        $"Failed to send password reset email to: {normalizedEmail}",
                        Logger);
                        
                    Logger.LogWarning("Failed to send password reset email to {Email}", normalizedEmail);
                }
            }
            else
            {
                // Password reset for ikke-eksisterende bruker
                await this.ReportSuspiciousActivityAsync(
                    ipBanService,
                    SuspiciousActivityTypes.API_ABUSE,
                    $"Password reset for non-existent email: {normalizedEmail}",
                    Logger);
            }

            // Samme melding uansett (security by obscurity)
            return Ok(new
            {
                message = "If the email address is registered, you will receive password reset instructions",
                success = true
            });
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error in ForgotPassword for {Email}", request.Email);
            
            await this.ReportSuspiciousActivityAsync(
                ipBanService,
                SuspiciousActivityTypes.API_ABUSE,
                $"Exception in forgot password: {ex.Message}",
                Logger);
                
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        try
        {
            // Valider token/kode først
            var isValid = await userService.ValidatePasswordResetTokenAsync(request.TokenOrCode);

            if (!isValid)
            {
                return BadRequest(new { message = "Invalid or expired reset token or code", success = false });
            }

            // Reset passordet
            var success = await userService.ResetPasswordAsync(request.TokenOrCode, request.NewPassword);

            if (success)
            {
                return Ok(new { message = "Password has been updated!", success = true });
            }

            return BadRequest(new { message = "Could not update password", success = false });
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error in ResetPassword");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpGet("validate-reset-token/{tokenOrCode}")]
    public async Task<IActionResult> ValidateResetToken(string tokenOrCode)
    {
        try
        {
            var isValid = await userService.ValidatePasswordResetTokenAsync(tokenOrCode);
            return Ok(new { isValid = isValid });
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error in ValidateResetToken");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpPost("resend-verification")]
    [EnableRateLimiting("auth")] // ⬅️ Legg til policy
    public async Task<IActionResult> ResendVerificationEmail([FromBody] ResendVerificationRequest request)
    {
        // Validering
        if (string.IsNullOrWhiteSpace(request.Email))
        {
            await this.ReportSuspiciousActivityAsync(
                ipBanService,
                SuspiciousActivityTypes.API_ABUSE,
                "Resend verification with empty email",
                Logger);
                
            return BadRequest(new { message = "Email is required." });
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        if (!IpBanExtensions.IsValidEmail(normalizedEmail))
        {
            await this.ReportSuspiciousActivityAsync(
                ipBanService,
                SuspiciousActivityTypes.API_ABUSE,
                $"Invalid email format in resend verification: {normalizedEmail}",
                Logger);
                
            return BadRequest(new { message = "Invalid email format." });
        }

        try
        {
            var user = await Context.Users
                .Include(u => u.VerificationInfo)
                .FirstOrDefaultAsync(u => u.Email == normalizedEmail);

            if (user == null)
            {
                await this.ReportSuspiciousActivityAsync(
                    ipBanService,
                    SuspiciousActivityTypes.API_ABUSE,
                    $"Resend verification requested for non-existent email: {normalizedEmail}",
                    Logger);

                Logger.LogInformation("Resend verification requested for non-existent email: {Email}", normalizedEmail);
                return Ok(new { message = "If an account exists for this email, a new verification link has been sent." });
            }

            if (user.EmailConfirmed)
            {
                Logger.LogInformation("Resend verification requested for already verified email: {Email}", normalizedEmail);
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
                    AppUser = user,
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

            await Context.SaveChangesAsync();

            // Send email
            var emailSent = await emailService.SendVerificationEmailAsync(user.Email, newToken, newCode);

            if (emailSent)
            {
                await userService.MarkVerificationEmailSentAsync(user.Email);
                Logger.LogInformation("Verification email resent successfully to {Email}", user.Email);
                
                return Ok(new
                {
                    message = "A new verification email has been sent with both web link and mobile code. Please check your inbox.",
                    emailSent = true
                });
            }
            else
            {
                await this.ReportSuspiciousActivityAsync(
                    ipBanService,
                    SuspiciousActivityTypes.VERIFICATION_EMAIL_FAILED,
                    $"Failed to resend verification email to: {user.Email}",
                    Logger);

                Logger.LogWarning("Failed to resend verification email to {Email}", user.Email);
                return Ok(new { message = "If an account exists for this email, a new verification link has been sent." });
            }
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error resending verification email to {Email}", normalizedEmail);
            
            await this.ReportSuspiciousActivityAsync(
                ipBanService,
                SuspiciousActivityTypes.API_ABUSE,
                $"Exception in resend verification for {normalizedEmail}: {ex.Message}",
                Logger);
                
            return Ok(new { message = "If an account exists for this email, a new verification link has been sent." });
        }
    }
}
