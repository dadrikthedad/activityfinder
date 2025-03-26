using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;

namespace AFBack.Controllers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AFBack.Models;
using AFBack.DTOs;
using AFBack.Data;


[Route("api/profile")]
[ApiController]
[Authorize]
public class ProfileController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ProfileController> _logger;

    public ProfileController(ApplicationDbContext context, ILogger<ProfileController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetProfile()
    {
        if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
        {
            return Unauthorized(new { message = "Invalid user ID in token." });
        }
        
        var profile = await _context.Profiles.Include(p => p.User).FirstOrDefaultAsync(p => p.UserId == userId);

        if (profile == null)
            return NotFound(new { message = "Profile not found." });

        var dto = new ProfileDTO
        {
            UserId = profile.UserId,
            ProfileImageUrl = profile.ProfileImageUrl,
            Bio = profile.Bio,
            Websites = profile.Websites,
            UpdatedAt = profile.UpdatedAt,
            TotalLikesGiven = profile.TotalLikesGiven,
            TotalLikesRecieved = profile.TotalLikesRecieved,
            TotalCommentsMade = profile.TotalCommentsMade,
            TotalMessagesRecieved = profile.TotalMessagesRecieved,
        };

        return Ok(dto);
    }

    [HttpPut]
    public async Task<IActionResult> UpdateProfile([FromBody] ProfileDTO dto)
    {
        if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
        {
            return Unauthorized(new { message = "Invalid user ID in token." });
        }
        
        var profile = await _context.Profiles.FirstOrDefaultAsync(p => p.UserId == userId);

        if (profile == null)
        {
            return NotFound(new { message = "Profile not found." });
        }

        profile.ProfileImageUrl = dto.ProfileImageUrl;
        profile.Bio = dto.Bio;
        profile.SetWebsites(dto.Websites ?? new List<string>());
        profile.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new { message = "Profile updated successfully" });
    }
    
    // Endring av profilbilde
    [HttpPatch("profile-image")]
    public async Task<IActionResult> UpdateProfileImage([FromBody] string imageUrl)
    {
        if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
        {
            return Unauthorized(new { message = "Invalid user ID in token." });
        }
        
        var profile = await _context.Profiles.FirstOrDefaultAsync(p => p.UserId == userId);
        if (profile == null)
            return NotFound(new { message = "Profile not found." });
        
        profile.ProfileImageUrl = imageUrl;
        profile.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return Ok(new { message = "Profile image updated." });
    }

    
    // Endring av Bio.
    [HttpPatch("bio")]
    public async Task<IActionResult> UpdateBio([FromBody] string newBio)
    {   
        if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
        {
            return Unauthorized(new { message = "Invalid user ID in token." });
        }
        
        var profile = await _context.Profiles.FirstOrDefaultAsync(p => p.UserId == userId);
        if (profile == null)
            return NotFound(new { message = "Profile not found." });

        profile.Bio = newBio;
        profile.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return Ok(new { message = "Bio updated successfully." });
    }
    
    [HttpPatch("websites")]
    public async Task<IActionResult> UpdateWebsites([FromBody] UpdateWebsitesDTO dto)
    {
        if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
        {
            return Unauthorized(new { message = "Invalid user ID in token." });
        }
        
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var profile = await _context.Profiles.FirstOrDefaultAsync(p => p.UserId == userId);
        if (profile == null)
            return NotFound(new { message = "Profile not found." });

        var cleaned = dto.Websites
            .Where(w => !string.IsNullOrWhiteSpace(w))
            .Select(w => w.Trim())
            .ToList();

        profile.SetWebsites(cleaned);
        profile.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new { message = "Websites updated successfully." });
    }

}