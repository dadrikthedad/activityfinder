using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using AFBack.DTOs;
using AFBack.Models;
using AFBack.Data;
using Microsoft.AspNetCore.Authorization;

namespace AFBack.Controllers;
// Kontroller KUN for innstillinger til bruker/profil
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
    
    // Denne brukes for å oppdatere innstillinger til bruker/profil fra /profilesettings. Hentes fra Frontend: updateUserSettings() via hooken useUpdateUserSettings.ts
    [Authorize]
    [HttpPatch]
    public async Task<IActionResult> UpdateSettings([FromBody] UserSettingsDTO dto)
    {
        try
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
            settings.ShowPostalCode = dto.ShowPostalCode;
            settings.ShowStats = dto.ShowStats;
            settings.ShowWebsites = dto.ShowWebsites;
        
            settings.RecieveEmailNotifications = dto.RecieveEmailNotifications;
            settings.RecievePushNotifications = dto.RecievePushNotifications;

            await _context.SaveChangesAsync();
        
            _logger.LogInformation("User {UserId} updated settings.", userId);

            return Ok(new { message = "Settings updated successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Error while updating settings");
            return StatusCode(500, new { message = "Internal server error", detail = ex.Message });
        }
        
    }
}
