using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using AFBack.Constants;
using AFBack.Data;
using AFBack.DTOs;
using AFBack.Extensions;
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
public class FileController : BaseController
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<FileController> _logger;
    private readonly BlobServiceClient _blobServiceClient;
    private readonly IHubContext<UserHub> _hubContext;
    private readonly MessageNotificationService _messageNotificationService;
    private readonly GroupNotificationService _groupNotificationService;
    private readonly IFileService _fileService;
    private readonly IMessageService _messageService;
    private readonly IBackgroundTaskQueue _taskQueue;
    private readonly IServiceScopeFactory _scopeFactory;
    
    public FileController(ApplicationDbContext context, ILogger<FileController> logger, BlobServiceClient blobServiceClient, IHubContext<UserHub> hubContext, MessageNotificationService messageNotificationService, GroupNotificationService groupNotificationService, IFileService fileService, IMessageService messageService, IBackgroundTaskQueue taskQueue, IServiceScopeFactory scopeFactory)
    {
        _context = context;
        _logger = logger;
        _hubContext = hubContext;
        _blobServiceClient = blobServiceClient;
        _messageNotificationService = messageNotificationService;
        _groupNotificationService = groupNotificationService;
        _fileService = fileService;
        _messageService = messageService;
        _taskQueue = taskQueue;
        _scopeFactory = scopeFactory;
    }
    
    [HttpPost("upload-profile-image")]
    public async Task<IActionResult> UploadProfileImage(IFormFile file = null, [FromForm] string action = null)
    {
        if (GetUserId() is not int userId)
            return Unauthorized();

        try
        {
            var profile = await _context.Profiles.FirstOrDefaultAsync(p => p.UserId == userId);
            if (profile == null) 
                return NotFound("Profile not found");

            string imageUrl = null;

            // Sjekk om det er en delete-operasjon
            if (action == "delete")
            {
                // Sett profilbilde til null (default avatar)
                imageUrl = null;
                _logger.LogInformation("User {UserId} removed their profile picture", userId);
            }
            else
            {
                // Normal upload-operasjon - sjekk at fil er oppgitt
                if (file == null)
                {
                    return BadRequest(new { message = "No file provided for upload" });
                }

                var (isValid, errorMessage) = _fileService.ValidateImage(file);
                if (!isValid)
                    return BadRequest(new { message = errorMessage });

                imageUrl = await _fileService.UploadFileAsync(file, "profile-pictures");
                _logger.LogInformation("User {UserId} uploaded a profile picture", userId);
            }

            // Notify venner og blokkere om profilbilde-endring
            UserSummaryExtensions.NotifyFriendsAndBlockersOfProfileUpdate(
                _taskQueue,
                _scopeFactory,
                userId, 
                new List<string> { "profileImageUrl" },
                new Dictionary<string, object> 
                { 
                    ["profileImageUrl"] = imageUrl 
                }
            );

            profile.ProfileImageUrl = imageUrl;
            profile.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            
            return Ok(new { imageUrl });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process profile image for user {UserId}", userId);
            return StatusCode(500, new { message = "Failed to process image" });
        }
    }
    
    [HttpPost("upload-group-image")]
    public async Task<IActionResult> UploadGroupImage(IFormFile file = null, int? groupId = null, [FromForm] string action = null)
    {
        if (GetUserId() is not int userId)
            return Unauthorized();

        Conversation? group = null;
        List<int> participantIds = new();
        
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
                return Forbid("You don't have permission to modify this group");
            
            // Hent participant IDs før SaveChanges
            participantIds = group.Participants.Select(p => p.UserId).ToList();
        }

        try
        {
            string imageUrl = null;

            // Sjekk om det er en delete-operasjon
            if (action == "delete")
            {
                // Sett gruppebilde til null (default group image)
                imageUrl = null;
                _logger.LogInformation("User {UserId} removed group image for group {GroupId}", userId, groupId);
            }
            else
            {
                // Normal upload-operasjon - sjekk at fil er oppgitt
                if (file == null)
                {
                    return BadRequest(new { message = "No file provided for upload" });
                }

                var (isValid, errorMessage) = _fileService.ValidateImage(file);
                if (!isValid)
                    return BadRequest(new { message = errorMessage });

                imageUrl = await _fileService.UploadFileAsync(file, "group-pictures");
                _logger.LogInformation("User {UserId} uploaded group image for group {GroupId}", userId, groupId);
            }

            // Oppdater gruppe hvis det er eksisterende
            if (groupId.HasValue && group != null)
            {
                group.GroupImageUrl = imageUrl;
                await _context.SaveChangesAsync();
                
                var userName = await _context.Users
                    .Where(u => u.Id == userId)
                    .Select(u => u.FullName)
                    .FirstOrDefaultAsync() ?? "En bruker";

                var actionText = action == "delete" ? "removed" : "changed";

                var systemMessage = await _messageNotificationService.CreateSystemMessageAsync(
                    groupId.Value,
                    $"{userName} has {actionText} the group image"
                );

                _logger.LogInformation("✅ System message created with ID: {MessageId}", systemMessage.Id);
                
                // Resten av sync event koden forblir det samme...
                _taskQueue.QueueAsync(async () => 
                {
                    using var scope = _scopeFactory.CreateScope();
                    var syncService = scope.ServiceProvider.GetRequiredService<SyncService>();
                    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                    try 
                    {
                        // 🔧 FIX: Hent conversation med User data fra ny context
                        var groupWithUsers = await context.Conversations
                            .Include(c => c.Participants)
                                .ThenInclude(p => p.User)
                                    .ThenInclude(u => u.Profile)
                            .FirstOrDefaultAsync(c => c.Id == groupId.Value);

                        if (groupWithUsers == null)
                        {
                            Console.WriteLine($"❌ Could not find group {groupId.Value} in background task");
                            return;
                        }

                        var userData = groupWithUsers.Participants
                            .Where(p => p.User != null) // Filter out null Users
                            .ToDictionary(
                                p => p.UserId,
                                p => (p.User.FullName ?? "Unknown User", p.User.Profile?.ProfileImageUrl)
                            );
                        
                        Console.WriteLine($"📊 Created userData for {userData.Count} participants");
                        
                        var participantApprovalStatus = await context.GroupRequests
                            .Where(gr => gr.ConversationId == groupId.Value && 
                                         participantIds.Contains(gr.ReceiverId))
                            .ToDictionaryAsync(gr => gr.ReceiverId, gr => gr.Status.ToString());

                        var conversationData = groupWithUsers.MapConversationToSyncData(
                            userId, 
                            userData, 
                            participantApprovalStatus
                        );
                        
                        await syncService.CreateAndDistributeSyncEventAsync(
                            eventType: SyncEventTypes.GROUP_INFO_UPDATED,
                            eventData: new {conversationData, systemMessage},
                            targetUserIds: participantIds,
                            source: "API",
                            relatedEntityId: groupId.Value,
                            relatedEntityType: "Conversation"
                        );
                        
                        Console.WriteLine($"✅ Sync event created successfully for group {groupId.Value}");
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"❌ Failed to create sync event for group image update. GroupId: {groupId.Value}, Error: {ex.Message}");
                    }
                });

                await _groupNotificationService.CreateGroupEventAsync(
                    GroupEventType.GroupImageChanged,
                    groupId.Value,
                    userId,
                    new List<int> { userId }
                );
            }

            return Ok(new { imageUrl });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process group image for user {UserId}, groupId: {GroupId}", userId, groupId);
            return StatusCode(500, new { message = "Failed to process image" });
        }
    }
    
     // 🆕 Nytt endepunkt for message attachments
    [HttpPost("upload-message-attachments")]
    public async Task<IActionResult> UploadMessageAttachments([FromForm] UploadAttachmentsRequestDTO request)
    {
        var senderId = GetUserId();
        if (senderId == null)
            return Unauthorized(new { message = "Ugyldig eller manglende bruker-ID i token." });

        if (request.Files == null || request.Files.Count == 0)
            return BadRequest(new { message = "Ingen filer oppgitt" });

        if (request.Files.Count > 10)
            return BadRequest(new { message = "Maksimalt 10 filer per melding" });
        
        // 🆕 Økt total størrelse for å støtte videoer
        const long maxTotalSize = 100 * 1024 * 1024; // 100MB (økt fra 20MB)
        var totalSize = request.Files.Sum(f => f.Length);
        if (totalSize > maxTotalSize)
        {
            return BadRequest(new
            {
                message = $"Total størrelse for alle filer overstiger {maxTotalSize / (1024 * 1024)} MB"
            });
        }

        // ✅ Valider alle filer først
        foreach (var file in request.Files)
        {
            var (isValid, errorMessage) = _fileService.ValidateFile(file);
            if (!isValid)
                return BadRequest(new { message = $"Feil med fil '{file.FileName}': {errorMessage}" });
        }
        
        var uploadedFileUrls = new List<string>();
        try
        {
            // 🔧 FIKSET: Process filer i samme rekkefølge som de kom inn
            var uploadTasks = request.Files.Select(file => 
            {
                var containerName = file.ContentType.StartsWith("video/") 
                    ? "message-videos" 
                    : "message-attachments";
                return _fileService.UploadFileAsync(file, containerName);
            });

            uploadedFileUrls = (await Task.WhenAll(uploadTasks).ConfigureAwait(false)).ToList();

            // ✅ Bygg attachments - nå matcher indeksene
            var attachments = request.Files.Select((file, index) => new AttachmentDto
            {
                FileUrl = uploadedFileUrls[index],
                FileType = file.ContentType,
                FileName = file.FileName,
                FileSize = file.Length
            }).ToList();
            
            // ✅ Send melding
            var sendMessageRequest = new SendMessageRequestDTO
            {
                Text = request.Text,
                Attachments = attachments,
                ConversationId = request.ConversationId,
                ReceiverId = request.ReceiverId,
                ParentMessageId = request.ParentMessageId
            };
            
            var response = await _messageService.SendMessageAsync(senderId.Value, sendMessageRequest)
                .ConfigureAwait(false);
                
            return Ok(response);
        }
        catch (ValidationException ex)
        {
            _logger.LogWarning("Validation error when sending message for user {UserId}: {Error}", senderId, ex.Message);
            await _fileService.CleanupUploadedFiles(uploadedFileUrls).ConfigureAwait(false);
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning("Business logic error when sending message for user {UserId}: {Error}", senderId, ex.Message);
            await _fileService.CleanupUploadedFiles(uploadedFileUrls).ConfigureAwait(false);
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error when sending message for user {UserId}", senderId);
            await _fileService.CleanupUploadedFiles(uploadedFileUrls).ConfigureAwait(false);
            return StatusCode(500, new { message = "Feil ved sending av melding" });
        }
    }
    
    // 🆕 Endepunkt for å bare laste opp filer (uten å sende melding)
    [HttpPost("upload-files")]
    public async Task<IActionResult> UploadFiles([FromForm] List<IFormFile> files, [FromQuery] string containerName = "attachments")
    {
        if (GetUserId() is not int userId)
            return Unauthorized();

        if (files == null || files.Count == 0)
            return BadRequest(new { message = "Ingen filer oppgitt" });

        if (files.Count > 10)
            return BadRequest(new { message = "Maksimalt 10 filer per request" });

        try
        {
            var results = new List<object>();
            
            foreach (var file in files)
            {
                var (isValid, errorMessage) = _fileService.ValidateFile(file);
                if (!isValid)
                {
                    results.Add(new 
                    { 
                        fileName = file.FileName, 
                        success = false, 
                        error = errorMessage 
                    });
                    continue;
                }

                try
                {
                    var fileUrl = await _fileService.UploadFileAsync(file, containerName);
                    results.Add(new 
                    { 
                        fileName = file.FileName, 
                        success = true, 
                        fileUrl = fileUrl,
                        fileType = file.ContentType
                    });
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to upload file {FileName} for user {UserId}", file.FileName, userId);
                    results.Add(new 
                    { 
                        fileName = file.FileName, 
                        success = false, 
                        error = "Opplasting feilet" 
                    });
                }
            }
            
            return Ok(new { results });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to upload files for user {UserId}", userId);
            return StatusCode(500, new { message = "Feil ved filopplasting" });
        }
    }
    
    // 🆕 Hjelpemetode for filvalidering (kan brukes av frontend)
    [HttpPost("validate-file")]
    public IActionResult ValidateFile(IFormFile file)
    {
        var (isValid, errorMessage) = _fileService.ValidateFile(file);
        
        if (!isValid)
            return BadRequest(new { message = errorMessage });
        
        return Ok(new 
        { 
            message = "Fil er gyldig", 
            contentType = file.ContentType, 
            size = file.Length,
            sizeInMB = Math.Round(file.Length / (1024.0 * 1024.0), 2)
        });
    }
}