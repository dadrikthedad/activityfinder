using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using AFBack.DTOs;
using AFBack.Models;
using AFBack.Data;
using Microsoft.AspNetCore.Authorization;

namespace AFBack.Controllers;

[ApiController]
[Route("api/usersettings")]
public class UserSettingsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<UserSettingsController> _logger;

    public UserSettingsController(ApplicationDbContext context, ILogger<UserSettingsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [Authorize]
    [HttpGet]
    public async Task<ActionResult<UserSettingsDTO>> GetSettings()
    {
        if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
            return Unauthorized();

        var settings = await _context.UserSettings.FirstOrDefaultAsync(s => s.UserId == userId);
        if (settings == null)
            return NotFound(new { message = "Settings not found" });

        var dto = new UserSettingsDTO
        {
            PublicProfile = settings.PublicProfile,
            ShowGender = settings.ShowGender,
            ShowEmail = settings.ShowEmail,
            ShowPhone = settings.ShowPhone,
            ShowRegion = settings.ShowRegion,
            Language = settings.Language,
            RecieveEmailNotifications = settings.RecieveEmailNotifications,
            RecievePushNotifications = settings.RecievePushNotifications
        };
        
        _logger.LogInformation("User {UserId} fetched settings.", userId);
        
        return Ok(dto);
    }

    [Authorize]
    [HttpPatch]
    public async Task<IActionResult> UpdateSettings([FromBody] UserSettingsDTO dto)
    {
        if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
            return Unauthorized();

        var settings = await _context.UserSettings.FirstOrDefaultAsync(s => s.UserId == userId);
        if (settings == null)
            return NotFound(new { message = "Settings not found" });

        settings.PublicProfile = dto.PublicProfile;
        settings.ShowGender = dto.ShowGender;
        settings.ShowEmail = dto.ShowEmail;
        settings.ShowPhone = dto.ShowPhone;
        settings.ShowRegion = dto.ShowRegion;
        settings.Language = dto.Language;
        settings.RecieveEmailNotifications = dto.RecieveEmailNotifications;
        settings.RecievePushNotifications = dto.RecievePushNotifications;

        await _context.SaveChangesAsync();
        
        _logger.LogInformation("User {UserId} updated settings.", userId);

        return Ok(new { message = "Settings updated successfully" });
    }
}
