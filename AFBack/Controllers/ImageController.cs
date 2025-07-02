using System.Security.Claims;
using AFBack.Data;
using AFBack.Hubs;
using AFBack.Models;
using AFBack.Services;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ImageController : BaseController
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ImageController> _logger;
    private readonly BlobServiceClient _blobServiceClient;
    private readonly IHubContext<ChatHub> _hubContext;
    private readonly MessageNotificationService _messageNotificationService;
    private readonly GroupNotificationService _groupNotificationService;

    public ImageController(ApplicationDbContext context, ILogger<ImageController> logger, BlobServiceClient blobServiceClient, IHubContext<ChatHub> hubContext, MessageNotificationService messageNotificationService, GroupNotificationService groupNotificationService)
    {
        _context = context;
        _logger = logger;
        _hubContext = hubContext;
        _blobServiceClient = blobServiceClient;
        _messageNotificationService = messageNotificationService;
        _groupNotificationService = groupNotificationService;
    }
    
    [HttpPost("upload-profile-image")]
    public async Task<IActionResult> UploadProfileImage(IFormFile file)
    {
        if (GetUserId() is not int userId)
            return Unauthorized();

        // 🆕 Bruk hjelpefunksjon for validering
        var (isValid, errorMessage) = ValidateImage(file);
        if (!isValid)
            return BadRequest(errorMessage);

        try
        {
            var fileName = $"user_{userId}_{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
            
            // 🆕 Bruk hjelpefunksjon for upload
            var imageUrl = await UploadImageToBlobAsync("profile-pictures", fileName, file);

            // Oppdater profil i database
            var profile = await _context.Profiles.FirstOrDefaultAsync(p => p.UserId == userId);
            if (profile == null) 
                return NotFound("Profile not found");

            profile.ProfileImageUrl = imageUrl;
            profile.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            
            _logger.LogInformation("User {UserId} uploaded a profile picture: {FileName}", userId, fileName);
            return Ok(new { imageUrl });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to upload profile image for user {UserId}", userId);
            return StatusCode(500, "Failed to upload image");
        }
    }

    [HttpPost("upload-group-image")]
    public async Task<IActionResult> UploadGroupImage(IFormFile file, int? groupId = null)
    {
        if (GetUserId() is not int userId)
            return Unauthorized();

        // 🆕 Bruk hjelpefunksjon for validering
        var (isValid, errorMessage) = ValidateImage(file);
        if (!isValid)
            return BadRequest(errorMessage);

        // Valider gruppetilgang
        Conversation? group = null;
        if (groupId.HasValue)
        {
            group = await _context.Conversations
                .Include(c => c.Participants)
                .FirstOrDefaultAsync(c => c.Id == groupId.Value && c.IsGroup);
            
            if (group == null)
                return NotFound("Group not found");

            var isParticipant = group.Participants.Any(p => p.UserId == userId);
            var isCreator = group.CreatorId == userId;
            
            if (!isParticipant && !isCreator)
                return Forbid("You don't have permission to upload image for this group");
        }

        try
        {
            var fileName = groupId.HasValue 
                ? $"group_{groupId}_{Guid.NewGuid()}{Path.GetExtension(file.FileName)}"
                : $"temp_group_{userId}_{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
            
            // 🆕 Bruk hjelpefunksjon for upload
            var imageUrl = await UploadImageToBlobAsync("group-pictures", fileName, file);

            // Oppdater gruppe hvis det er eksisterende
            if (groupId.HasValue && group != null)
            {
                group.GroupImageUrl = imageUrl;
                await _context.SaveChangesAsync();

                var userName = await _context.Users
                    .Where(u => u.Id == userId)
                    .Select(u => u.FullName)
                    .FirstOrDefaultAsync() ?? "En bruker";

                var systemMessageTask = _messageNotificationService.CreateSystemMessageAsync(
                    groupId.Value,
                    $"{userName} has changed the group image"
                );

                var groupEventTask = _groupNotificationService.CreateGroupEventAsync(
                    GroupEventType.GroupImageChanged,
                    groupId.Value,
                    userId,
                    new List<int> { userId }
                );

                await Task.WhenAll(systemMessageTask, groupEventTask);
            }

            _logger.LogInformation("User {UserId} uploaded group image: {FileName}", userId, fileName);
            return Ok(new { imageUrl });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to upload group image for user {UserId}, groupId: {GroupId}", userId, groupId);
            return StatusCode(500, "Failed to upload image");
        }
    }
    
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // 🆕 Hjelpefunksjoner som kan gjenbrukes
    private (bool IsValid, string? ErrorMessage) ValidateImage(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return (false, "No file provided");

        var allowedTypes = new[] { "image/jpeg", "image/png", "image/webp", "image/gif" };
        if (!allowedTypes.Contains(file.ContentType))
            return (false, "Only image files (jpg, png, webp, gif) are allowed.");

        const long maxSizeInBytes = 10 * 1024 * 1024; // 10MB
        if (file.Length > maxSizeInBytes)
            return (false, "File too large. Max size is 10MB.");

        return (true, null);
    }

    private async Task<string> UploadImageToBlobAsync(string containerName, string fileName, IFormFile file)
    {
        var containerClient = _blobServiceClient.GetBlobContainerClient(containerName);
        await containerClient.CreateIfNotExistsAsync();
        
        var blobClient = containerClient.GetBlobClient(fileName);
        
        await using var stream = file.OpenReadStream();
        await blobClient.UploadAsync(stream, new BlobHttpHeaders { ContentType = file.ContentType });
        
        return blobClient.Uri.ToString();
    }
}