using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;

namespace AFBack.Controllers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AFBack.Models;
using AFBack.DTOs;
using AFBack.Data;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;


[Route("api/profile")]
[ApiController]
[Authorize]
public class ProfileController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ProfileController> _logger;
    private readonly BlobServiceClient _blobServiceClient;

    public ProfileController(ApplicationDbContext context, ILogger<ProfileController> logger, BlobServiceClient blobServiceClient)
    {
        _context = context;
        _logger = logger;
        _blobServiceClient = blobServiceClient;
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
    
    // Henter en bruker sin profil
    [AllowAnonymous]
    [HttpGet("{id}")]
    public async Task<IActionResult> GetPublicProfile(int id)
    {
        var profile = await _context.Profiles
            .Include(p => p.User)
            .FirstOrDefaultAsync(p => p.UserId == id);

        if (profile == null)
            return NotFound(new { message = "Profile not found" });

        var dto = new PublicProfileDTO
        {
            UserId = profile.UserId,
            FullName = profile.User.FullName,
            ProfileImageUrl = profile.ProfileImageUrl,
            Bio = profile.Bio,
            Websites = profile.Websites,
            Country = profile.User.Country,
            Region = profile.User.Region,
            TotalLikesGiven = profile.TotalLikesGiven,
            TotalLikesRecieved = profile.TotalLikesRecieved,
            TotalCommentsMade = profile.TotalCommentsMade,
            TotalMessagesRecieved = profile.TotalMessagesRecieved,
            TotalMessagesSendt = profile.TotalMessagesSendt,
            UpdatedAt = profile.UpdatedAt,
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
    [HttpPost("upload-profile-image")]
    public async Task<IActionResult> UploadProfileImage(IFormFile file)
    {
        if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
            return Unauthorized();

        if (file == null || file.Length == 0)
            return BadRequest("No file provided");

        // OPTIONAL: Validate image type and size here

        var containerName = "profile-pictures";
        var containerClient = _blobServiceClient.GetBlobContainerClient("profile-pictures");
        
        var allowedTypes = new[] { "image/jpeg", "image/png", "image/webp", "image/gif" };
        if (!allowedTypes.Contains(file.ContentType))
            return BadRequest("Only image files (jpg, png, webp, gif) are allowed.");
        
        const long maxSizeInBytes = 10 * 1024 * 1024;
        if (file.Length > maxSizeInBytes)
            return BadRequest("File too large. Max size is 10MB.");

        var fileName = $"user_{userId}_{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
        var blobClient = containerClient.GetBlobClient(fileName);

        await using (var stream = file.OpenReadStream())
        {
            await blobClient.UploadAsync(stream, new BlobHttpHeaders { ContentType = file.ContentType });
        }

        var imageUrl = blobClient.Uri.ToString();

        // Save the image URL to the database
        var profile = await _context.Profiles.FirstOrDefaultAsync(p => p.UserId == userId);
        if (profile == null) return NotFound();

        profile.ProfileImageUrl = imageUrl;
        profile.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        
        _logger.LogInformation("User {UserId} uploaded a profile picture: {FileName}", userId, fileName);

        return Ok(new { imageUrl });
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