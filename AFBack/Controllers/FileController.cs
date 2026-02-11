using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using AFBack.Constants;
using AFBack.Data;
using AFBack.DTOs;
using AFBack.Extensions;
using AFBack.Features.Cache;
using AFBack.Features.Cache.Interface;
using AFBack.Features.Conversation.Models;
using AFBack.Features.MessageNotifications.Service;
using AFBack.Features.SyncEvents.Services;
using AFBack.Hubs;
using AFBack.Infrastructure.Services;
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
public class FileController(
    AppDbContext context,
    ILogger<FileController> logger,
    BlobServiceClient blobServiceClient,
    IHubContext<UserHub> hubContext,
    IMessageNotificationService messageNotificationService,
    GroupNotificationService groupNotificationService,
    IFileService fileService,
    IMessageService messageService,
    IBackgroundTaskQueue taskQueue,
    IServiceScopeFactory scopeFactory,
    IUserCache userCache,
    ResponseService responseService)
    : BaseController<FileController>(context, logger, userCache, responseService)
{
    private readonly BlobServiceClient _blobServiceClient = blobServiceClient;
    private readonly IHubContext<UserHub> _hubContext = hubContext;

    [HttpPost("upload-profile-image")]
    public async Task<IActionResult> UploadProfileImage(IFormFile file = null, [FromForm] string action = null)
    {
        if (GetUserId() is not int userId)
            return Unauthorized();

        try
        {
            
            var user = await Context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) 
                return NotFound("UserProfile not found");

            string imageUrl = null;

            // Sjekk om det er en delete-operasjon
            if (action == "delete")
            {
                // Sett profilbilde til null (default avatar)
                imageUrl = null;
                Logger.LogInformation("AppUser {UserId} removed their profile picture", userId);
            }
            else
            {
                // Normal upload-operasjon - sjekk at fil er oppgitt
                if (file == null)
                {
                    return BadRequest(new { message = "No file provided for upload" });
                }

                var (isValid, errorMessage) = fileService.ValidateImage(file);
                if (!isValid)
                    return BadRequest(new { message = errorMessage });

                imageUrl = await fileService.UploadFileAsync(file, "profile-pictures");
                Logger.LogInformation("AppUser {UserId} uploaded a profile picture", userId);
            }

            // Notify venner og blokkere om profilbilde-endring
            UserSummaryExtensions.NotifyFriendsAndBlockersOfProfileUpdate(
                taskQueue,
                scopeFactory,
                userId, 
                new List<string> { "profileImageUrl" },
                new Dictionary<string, object> 
                { 
                    ["profileImageUrl"] = imageUrl 
                }
            );

            user.ProfileImageUrl = imageUrl;
  
            await Context.SaveChangesAsync();
            
            return Ok(new { imageUrl });
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Failed to process profile image for appUser {UserId}", userId);
            return StatusCode(500, new { message = "Failed to process image" });
        }
    }
    
    [HttpPost("upload-group-image")]
    public async Task<IActionResult> UploadGroupImage([FromForm] UploadGroupImageDTO request)
    {
        Logger.LogInformation("🔵 UploadGroupImage called - file: {FileName}, groupId: {GroupId}, action: {Action}", 
            request.File?.FileName, request.GroupId, request.Action);
        
        if (GetUserId() is not int userId)
        {
            Logger.LogWarning("❌ Unauthorized - no userId");
            return Unauthorized();
        }

        Logger.LogInformation("✅ Authorized appUser: {UserId}", userId);

        Conversation? group = null;
        List<int> participantIds = new();
        
        try
        {
            if (request.GroupId.HasValue)
            {
                Logger.LogInformation("🔍 Looking for group {GroupId}", request.GroupId.Value);
                
                group = await Context.Conversations
                    .Include(c => c.Participants)
                    .FirstOrDefaultAsync(c => c.Id == request.GroupId.Value && c.IsGroup);
                
                if (group == null)
                {
                    Logger.LogWarning("❌ Group {GroupId} not found", request.GroupId.Value);
                    return NotFound("Group not found");
                }

                Logger.LogInformation("✅ Found group {GroupId} with {ParticipantCount} participants", 
                    request.GroupId.Value, group.Participants.Count);

                var isParticipant = group.Participants.Any(p => p.UserId == userId);
                var isCreator = jdkslafdjabkfjdaf her må vi fikse
                
                Logger.LogInformation("🔍 AppUser {UserId} - isParticipant: {IsParticipant}, isCreator: {IsCreator}", 
                    userId, isParticipant, isCreator);
                
                if (!isParticipant && !isCreator)
                {
                    Logger.LogWarning("❌ AppUser {UserId} has no permission for group {GroupId}", userId, request.GroupId.Value);
                    return Forbid("You don't have permission to modify this group");
                }
                
                // Hent participant IDs før SaveChanges
                participantIds = group.Participants.Select(p => p.UserId).ToList();
                Logger.LogInformation("📊 Participant IDs: [{ParticipantIds}]", string.Join(", ", participantIds));
            }
            else
            {
                Logger.LogInformation("⚠️ No groupId provided - creating temporary file");
            }

            string imageUrl = null;

            // Sjekk om det er en delete-operasjon
            if (request.Action == "delete")
            {
                Logger.LogInformation("🗑️ Delete operation detected");
                imageUrl = null;
            }
            else
            {
                Logger.LogInformation("📤 Upload operation detected");
                
                // Normal upload-operasjon - sjekk at fil er oppgitt
                if (request.File == null)
                {
                    Logger.LogWarning("❌ No file provided for upload");
                    return BadRequest(new { message = "No file provided for upload" });
                }

                Logger.LogInformation("📁 File received: {FileName}, size: {FileSize} bytes", 
                    request.File.FileName, request.File.Length);

                var (isValid, errorMessage) = fileService.ValidateImage(request.File);
                if (!isValid)
                {
                    Logger.LogWarning("❌ File validation failed: {ErrorMessage}", errorMessage);
                    return BadRequest(new { message = errorMessage });
                }

                Logger.LogInformation("✅ File validation passed");

                imageUrl = await fileService.UploadFileAsync(request.File, "group-pictures");
                Logger.LogInformation("✅ File uploaded successfully: {ImageUrl}", imageUrl);
            }

            // Oppdater gruppe hvis det er eksisterende
            if (request.GroupId.HasValue && group != null)
            {
                Logger.LogInformation("💾 Updating group {GroupId} in database", request.GroupId.Value);
                group.GroupImageUrl = imageUrl;
                await Context.SaveChangesAsync();
                Logger.LogInformation("✅ Group updated in database");
                
                Logger.LogInformation("👤 Getting appUser name for appUser {UserId}", userId);
                var userName = await Context.Users
                    .Where(u => u.Id == userId)
                    .Select(u => u.FullName)
                    .FirstOrDefaultAsync() ?? "En bruker";
                Logger.LogInformation("✅ Got appUser name: {UserName}", userName);

                var actionText = request.Action == "delete" ? "removed" : "changed";
                
                Logger.LogInformation("📝 Creating system message for action: {ActionText}", actionText);
                var systemMessage = await messageNotificationService.CreateSystemMessageAsync(
                    request.GroupId.Value,
                    $"{userName} has {actionText} the group image"
                );
                Logger.LogInformation("✅ System message created with ID: {MessageId}", systemMessage.Id);

                Logger.LogInformation("🔄 Queueing background task for sync events");
                taskQueue.QueueAsync(async () => 
                {
                    using var scope = scopeFactory.CreateScope();
                    var syncService = scope.ServiceProvider.GetRequiredService<ISyncService>();
                    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                    try 
                    {
                        // Fixed background task code from earlier
                        var groupWithUsers = await context.Conversations
                            .Include(c => c.Participants)
                                .ThenInclude(p => p.AppUser)
                                    .ThenInclude(u => u.UserProfile)
                            .FirstOrDefaultAsync(c => c.Id == request.GroupId.Value);

                        if (groupWithUsers == null)
                        {
                            Logger.LogWarning("❌ Could not find group {GroupId} in background task", request.GroupId.Value);
                            return;
                        }

                        var userData = groupWithUsers.Participants
                            .Where(p => p.AppUser != null)
                            .ToDictionary(
                                p => p.UserId,
                                p => (p.AppUser.FullName ?? "Unknown AppUser", p.AppUser.ProfileImageUrl)
                            );
                        
                        Logger.LogInformation("📊 Created userData for {UserCount} participants", userData.Count);
                        
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
                            relatedEntityType: "Conversations"
                        );
                        
                        Logger.LogInformation("✅ Sync event created successfully for group {GroupId}", request.GroupId.Value);
                    }
                    catch (Exception ex)
                    {
                        Logger.LogError(ex, "❌ Failed to create sync event for group image update. GroupId: {GroupId}", request.GroupId.Value);
                    }
                });

                Logger.LogInformation("🔔 Creating group notification");
                await groupNotificationService.CreateGroupEventAsync(
                    GroupEventType.GroupImageChanged,
                    request.GroupId.Value,
                    userId,
                    new List<int> { userId }
                );
                Logger.LogInformation("✅ Group notification created");
            }

            Logger.LogInformation("🎯 Returning response with imageUrl: {ImageUrl}", imageUrl);
            return Ok(new { imageUrl });
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "❌ EXCEPTION in UploadGroupImage for appUser {UserId}, groupId {GroupId}", userId, request.GroupId);
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
            var (isValid, errorMessage) = fileService.ValidateFile(file);
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
                return fileService.UploadFileAsync(file, containerName);
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
            
            var response = await messageService.SendMessageAsync(senderId.Value, sendMessageRequest)
                .ConfigureAwait(false);
                
            return Ok(response);
        }
        catch (ValidationException ex)
        {
            Logger.LogWarning("Validation error when sending message for appUser {UserId}: {Error}", senderId, ex.Message);
            await fileService.CleanupUploadedFiles(uploadedFileUrls).ConfigureAwait(false);
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            Logger.LogWarning("Business logic error when sending message for appUser {UserId}: {Error}", senderId, ex.Message);
            await fileService.CleanupUploadedFiles(uploadedFileUrls).ConfigureAwait(false);
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Unexpected error when sending message for appUser {UserId}", senderId);
            await fileService.CleanupUploadedFiles(uploadedFileUrls).ConfigureAwait(false);
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
                var (isValid, errorMessage) = fileService.ValidateFile(file);
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
                    var fileUrl = await fileService.UploadFileAsync(file, containerName);
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
                    Logger.LogError(ex, "Failed to upload file {FileName} for appUser {UserId}", file.FileName, userId);
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
            Logger.LogError(ex, "Failed to upload files for appUser {UserId}", userId);
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
            var report = await Context.Reports
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
            var (isValid, errorMessage) = fileService.ValidateFile(file);
            if (!isValid)
                return BadRequest(new { message = errorMessage });

            // Last opp fil
            var fileUrl = await fileService.UploadFileAsync(file, "report-attachments");
            
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

            Context.ReportAttachments.Add(attachment);
            await Context.SaveChangesAsync();

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
            Logger.LogError(ex, "Failed to upload attachment for report {ReportId}", reportId);
            return StatusCode(500, new { message = "Failed to upload attachment" });
        }
    }
    
    // 🆕 Hjelpemetode for filvalidering (kan brukes av frontend)
    [HttpPost("validate-file")]
    public IActionResult ValidateFile(IFormFile file)
    {
        var (isValid, errorMessage) = fileService.ValidateFile(file);
        
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
