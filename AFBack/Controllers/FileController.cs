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
    
    public FileController(ApplicationDbContext context, 
        ILogger<FileController> logger, 
        BlobServiceClient blobServiceClient, 
        IHubContext<UserHub> hubContext, 
        MessageNotificationService messageNotificationService, 
        GroupNotificationService groupNotificationService, 
        IFileService fileService, 
        IMessageService messageService, 
        IBackgroundTaskQueue taskQueue, 
        IServiceScopeFactory scopeFactory)
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
    public async Task<IActionResult> UploadGroupImage([FromForm] UploadGroupImageDTO request)
    {
        _logger.LogInformation("🔵 UploadGroupImage called - file: {FileName}, groupId: {GroupId}, action: {Action}", 
            request.File?.FileName, request.GroupId, request.Action);
        
        if (GetUserId() is not int userId)
        {
            _logger.LogWarning("❌ Unauthorized - no userId");
            return Unauthorized();
        }

        _logger.LogInformation("✅ Authorized user: {UserId}", userId);

        Conversation? group = null;
        List<int> participantIds = new();
        
        try
        {
            if (request.GroupId.HasValue)
            {
                _logger.LogInformation("🔍 Looking for group {GroupId}", request.GroupId.Value);
                
                group = await _context.Conversations
                    .Include(c => c.Participants)
                    .FirstOrDefaultAsync(c => c.Id == request.GroupId.Value && c.IsGroup);
                
                if (group == null)
                {
                    _logger.LogWarning("❌ Group {GroupId} not found", request.GroupId.Value);
                    return NotFound("Group not found");
                }

                _logger.LogInformation("✅ Found group {GroupId} with {ParticipantCount} participants", 
                    request.GroupId.Value, group.Participants.Count);

                var isParticipant = group.Participants.Any(p => p.UserId == userId);
                var isCreator = group.CreatorId == userId;
                
                _logger.LogInformation("🔍 User {UserId} - isParticipant: {IsParticipant}, isCreator: {IsCreator}", 
                    userId, isParticipant, isCreator);
                
                if (!isParticipant && !isCreator)
                {
                    _logger.LogWarning("❌ User {UserId} has no permission for group {GroupId}", userId, request.GroupId.Value);
                    return Forbid("You don't have permission to modify this group");
                }
                
                // Hent participant IDs før SaveChanges
                participantIds = group.Participants.Select(p => p.UserId).ToList();
                _logger.LogInformation("📊 Participant IDs: [{ParticipantIds}]", string.Join(", ", participantIds));
            }
            else
            {
                _logger.LogInformation("⚠️ No groupId provided - creating temporary file");
            }

            string imageUrl = null;

            // Sjekk om det er en delete-operasjon
            if (request.Action == "delete")
            {
                _logger.LogInformation("🗑️ Delete operation detected");
                imageUrl = null;
            }
            else
            {
                _logger.LogInformation("📤 Upload operation detected");
                
                // Normal upload-operasjon - sjekk at fil er oppgitt
                if (request.File == null)
                {
                    _logger.LogWarning("❌ No file provided for upload");
                    return BadRequest(new { message = "No file provided for upload" });
                }

                _logger.LogInformation("📁 File received: {FileName}, size: {FileSize} bytes", 
                    request.File.FileName, request.File.Length);

                var (isValid, errorMessage) = _fileService.ValidateImage(request.File);
                if (!isValid)
                {
                    _logger.LogWarning("❌ File validation failed: {ErrorMessage}", errorMessage);
                    return BadRequest(new { message = errorMessage });
                }

                _logger.LogInformation("✅ File validation passed");

                imageUrl = await _fileService.UploadFileAsync(request.File, "group-pictures");
                _logger.LogInformation("✅ File uploaded successfully: {ImageUrl}", imageUrl);
            }

            // Oppdater gruppe hvis det er eksisterende
            if (request.GroupId.HasValue && group != null)
            {
                _logger.LogInformation("💾 Updating group {GroupId} in database", request.GroupId.Value);
                group.GroupImageUrl = imageUrl;
                await _context.SaveChangesAsync();
                _logger.LogInformation("✅ Group updated in database");
                
                _logger.LogInformation("👤 Getting user name for user {UserId}", userId);
                var userName = await _context.Users
                    .Where(u => u.Id == userId)
                    .Select(u => u.FullName)
                    .FirstOrDefaultAsync() ?? "En bruker";
                _logger.LogInformation("✅ Got user name: {UserName}", userName);

                var actionText = request.Action == "delete" ? "removed" : "changed";
                
                _logger.LogInformation("📝 Creating system message for action: {ActionText}", actionText);
                var systemMessage = await _messageNotificationService.CreateSystemMessageAsync(
                    request.GroupId.Value,
                    $"{userName} has {actionText} the group image"
                );
                _logger.LogInformation("✅ System message created with ID: {MessageId}", systemMessage.Id);

                _logger.LogInformation("🔄 Queueing background task for sync events");
                _taskQueue.QueueAsync(async () => 
                {
                    using var scope = _scopeFactory.CreateScope();
                    var syncService = scope.ServiceProvider.GetRequiredService<SyncService>();
                    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                    try 
                    {
                        // Fixed background task code from earlier
                        var groupWithUsers = await context.Conversations
                            .Include(c => c.Participants)
                                .ThenInclude(p => p.User)
                                    .ThenInclude(u => u.Profile)
                            .FirstOrDefaultAsync(c => c.Id == request.GroupId.Value);

                        if (groupWithUsers == null)
                        {
                            _logger.LogWarning("❌ Could not find group {GroupId} in background task", request.GroupId.Value);
                            return;
                        }

                        var userData = groupWithUsers.Participants
                            .Where(p => p.User != null)
                            .ToDictionary(
                                p => p.UserId,
                                p => (p.User.FullName ?? "Unknown User", p.User.Profile?.ProfileImageUrl)
                            );
                        
                        _logger.LogInformation("📊 Created userData for {UserCount} participants", userData.Count);
                        
                        var participantApprovalStatus = await context.GroupRequests
                            .Where(gr => gr.ConversationId == request.GroupId.Value && 
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
                            relatedEntityId: request.GroupId.Value,
                            relatedEntityType: "Conversation"
                        );
                        
                        _logger.LogInformation("✅ Sync event created successfully for group {GroupId}", request.GroupId.Value);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "❌ Failed to create sync event for group image update. GroupId: {GroupId}", request.GroupId.Value);
                    }
                });

                _logger.LogInformation("🔔 Creating group notification");
                await _groupNotificationService.CreateGroupEventAsync(
                    GroupEventType.GroupImageChanged,
                    request.GroupId.Value,
                    userId,
                    new List<int> { userId }
                );
                _logger.LogInformation("✅ Group notification created");
            }

            _logger.LogInformation("🎯 Returning response with imageUrl: {ImageUrl}", imageUrl);
            return Ok(new { imageUrl });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ EXCEPTION in UploadGroupImage for user {UserId}, groupId {GroupId}", userId, request.GroupId);
            return StatusCode(500, new { message = "Failed to process image", error = ex.Message });
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
    
    [ApiExplorerSettings(IgnoreApi = true)]
    [HttpPost("{reportId}/attachments")]
    public async Task<IActionResult> UploadReportAttachment(
        Guid reportId, 
        [FromForm] IFormFile file)
    {
        if (file == null)
            return BadRequest(new { message = "No file provided" });

        try
        {
            var userId = GetUserId();
            
            // Hent rapporten med eksisterende attachments
            var report = await _context.Reports
                .Include(r => r.Attachments)
                .FirstOrDefaultAsync(r => r.Id == reportId);
            
            if (report == null)
                return NotFound("Report not found");

            // OPPDATERT: Tilgangskontroll som håndterer anonymous rapporter
            if (report.SubmittedByUserId.HasValue)
            {
                // Rapport har en eier - kun eieren kan legge til attachments
                if (report.SubmittedByUserId != userId)
                    return StatusCode(403, new { message = "Access denied - you can only upload to your own reports" });
            }
            else
            {
                // Anonymous rapport - du kan ikke legge til attachments til anonymous rapporter
                return StatusCode(403, new { message = "Cannot add attachments to anonymous reports" });
            }

            // Sjekk maksimalt antall attachments per rapport (f.eks. 5)
            if (report.Attachments.Count >= 5)
                return BadRequest(new { message = "Maximum number of attachments (5) reached" });

            // Valider fil
            var (isValid, errorMessage) = _fileService.ValidateFile(file);
            if (!isValid)
                return BadRequest(new { message = errorMessage });

            // Last opp fil
            var fileUrl = await _fileService.UploadFileAsync(file, "report-attachments");
            
            // Opprett attachment record
            var attachment = new ReportAttachment
            {
                ReportId = reportId,
                FileUrl = fileUrl,
                FileType = file.ContentType,
                FileSize = file.Length,
                FileName = file.FileName,
                UploadedAt = DateTime.UtcNow
            };

            _context.ReportAttachments.Add(attachment);
            await _context.SaveChangesAsync();

            return Ok(new { 
                AttachmentId = attachment.Id,
                FileUrl = fileUrl,
                FileName = file.FileName,
                FileSize = file.Length,
                FileType = file.ContentType,
                UploadedAt = attachment.UploadedAt
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to upload attachment for report {ReportId}", reportId);
            return StatusCode(500, new { message = "Failed to upload attachment" });
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