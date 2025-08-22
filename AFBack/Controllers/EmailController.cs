using AFBack.Data;
using AFBack.DTOs.Email;
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
    private readonly ILogger<EmailController> _logger;
    private readonly ApplicationDbContext _context;

    public EmailController(EmailService emailService, UserService userService, ILogger<EmailController> logger, ApplicationDbContext context)
    {
        _context = context;
        _emailService = emailService;
        _userService = userService;
        _logger = logger;
    }

    [HttpPost("send-verification")]
    public async Task<IActionResult> SendVerificationEmail([FromBody] SendVerificationRequest request)
    {
        try
        {
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
            return StatusCode(500, new { message = "Internal server error", error = ex.Message });
        }
    }

    [HttpPost("verify")]
    public async Task<IActionResult> VerifyEmail([FromBody] VerifyEmailRequest request)
    {
        try
        {
            var isValid = await _userService.VerifyEmailTokenAsync(request.Token);

            if (isValid)
            {
                // Send velkomstepost
                var user = await _userService.GetUserByTokenAsync(request.Token);
                if (user != null)
                {
                    await _emailService.SendWelcomeEmailAsync(user.Email, user.FullName);
                }

                return Ok(new { message = "Email verified!", success = true });
            }

            return BadRequest(new { message = "Invaldig or expired verification code", success = false });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Network error", error = ex.Message });
        }
    }


    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        try
        {
            // Opprett reset token
            var token = await _userService.CreatePasswordResetTokenAsync(request.Email);

            if (token != null)
            {
                // Send epost
                var success = await _emailService.SendForgotPasswordEmailAsync(request.Email, token);

                if (!success)
                {
                    return StatusCode(500, new { message = "Kunne ikke sende epost", success = false });
                }
            }

            // Returner alltid samme melding for sikkerhet (ikke avslør om eposten eksisterer)
            return Ok(new
            {
                message = "Hvis epostadressen er registrert, vil du motta en reset-link",
                success = true
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Intern serverfeil", error = ex.Message });
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
                return BadRequest(new { message = "Ugyldig eller utløpt reset-token", success = false });
            }

            // Reset passordet
            var success = await _userService.ResetPasswordAsync(request.Token, request.NewPassword);

            if (success)
            {
                return Ok(new { message = "Passordet er oppdatert!", success = true });
            }

            return BadRequest(new { message = "Kunne ikke oppdatere passordet", success = false });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Intern serverfeil", error = ex.Message });
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
            return StatusCode(500, new { message = "Intern serverfeil", error = ex.Message });
        }
    }

    [HttpPost("resend-verification")]
    public async Task<IActionResult> ResendVerificationEmail([FromBody] ResendVerificationRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
            return BadRequest(new { message = "Email is required." });

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail);

        if (user == null)
        {
            // Ikke avslør at brukeren ikke finnes - samme melding som ved suksess
            _logger.LogInformation("Resend verification requested for non-existent email: {Email}", normalizedEmail);
            return Ok(new { message = "If an account exists for this email, a new verification link has been sent." });
        }

        if (user.EmailConfirmed)
        {
            _logger.LogInformation("Resend verification requested for already verified email: {Email}", normalizedEmail);
            return Ok(new
            {
                message = "Your email is already verified. You can log in.",
                alreadyVerified = true
            });
        }

        if (user.LastVerificationEmailSent.HasValue &&
            user.LastVerificationEmailSent.Value.AddMinutes(2) > DateTime.UtcNow)
        {
            return BadRequest(new { message = "Please wait before requesting another verification email." });
        }

        try
        {
            // *** GENERER BÅDE LANG TOKEN OG KORT KODE ***
            var newToken = Guid.NewGuid().ToString(); // For web/deep links
            var newCode = new Random().Next(100000, 999999).ToString(); // For manuell input

            user.EmailConfirmationToken = newToken;
            user.EmailConfirmationCode = newCode; // Legg til kort kode
            user.LastVerificationEmailSent = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            // *** SEND BEGGE TOKENS TIL EMAIL SERVICE ***
            var emailSent = await _emailService.SendVerificationEmailAsync(user.Email, newToken, newCode);

            if (emailSent)
            {
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
                // Ikke avslør tekniske detaljer - samme melding som ved suksess for sikkerhet
                return Ok(new { message = "If an account exists for this email, a new verification link has been sent." });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError("Error resending verification email to {Email}: {Error}", user.Email, ex.Message);
            // Samme melding for sikkerhet - ikke avslør tekniske feil
            return Ok(new { message = "If an account exists for this email, a new verification link has been sent." });
        }
    }
}
