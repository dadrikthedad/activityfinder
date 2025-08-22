using AFBack.DTOs.Email;
using AFBack.Services;
using Microsoft.AspNetCore.Mvc;

namespace AFBack.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EmailController : BaseController
{
    private readonly EmailService _emailService;
    private readonly UserService _userService;

    public EmailController(EmailService emailService, UserService userService)
    {
        _emailService = emailService;
        _userService = userService;
    }

    [HttpPost("send-verification")]
    public async Task<IActionResult> SendVerificationEmail([FromBody] SendVerificationRequest request)
    {
        try
        {
            // Opprett verifikasjontoken
            var token = await _userService.CreateVerificationTokenAsync(request.Email);
            
            // Send epost
            var success = await _emailService.SendVerificationEmailAsync(request.Email, token);
            
            if (success)
            {
                return Ok(new { message = "Verifikasjonsepost sendt", success = true });
            }
            
            return BadRequest(new { message = "Kunne ikke sende epost", success = false });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Intern serverfeil", error = ex.Message });
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
                
                return Ok(new { message = "Epostadresse verifisert!", success = true });
            }
            
            return BadRequest(new { message = "Ugyldig eller utløpt verifikasjontoken", success = false });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Intern serverfeil", error = ex.Message });
        }
    }

    [HttpPost("test")]
    public async Task<IActionResult> TestEmail([FromBody] TestEmailRequest request)
    {
        try
        {
            var success = await _emailService.SendVerificationEmailAsync(request.Email, "test-token-123");
            
            if (success)
            {
                return Ok(new { message = "Test-epost sendt!", success = true });
            }
            
            return BadRequest(new { message = "Kunne ikke sende test-epost", success = false });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Test feilet", error = ex.Message });
        }
    }
}
