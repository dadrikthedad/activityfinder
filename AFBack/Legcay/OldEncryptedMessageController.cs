// using System.ComponentModel.DataAnnotations;
// using System.Text.Json;
// using AFBack.Data;
// using AFBack.DTOs.Crypto;
// using AFBack.DTOs.Crypto.EncryptedMessageAttachments;
// using AFBack.Features.Cache.Interface;
// using AFBack.Features.MessageNotifications.Service;
// using AFBack.Hubs;
// using AFBack.Infrastructure.Services;
// using AFBack.Interface.Services;
// using AFBack.Services;
// using AFBack.Services.Crypto;
// using Azure.Storage.Blobs;
// using Microsoft.AspNetCore.Authorization;
// using Microsoft.AspNetCore.Mvc;
// using Microsoft.AspNetCore.SignalR;
// using Microsoft.EntityFrameworkCore;
//
// namespace AFBack.Controllers;
//
// [ApiController]
// [Route("api/[controller]")]
// [Authorize]
// public class EncryptedMessageController(
//     AppDbContext context,
//     ILogger<FileController> logger,
//     BlobServiceClient blobServiceClient,
//     IHubContext<UserHub> hubContext,
//     IMessageNotificationService messageNotificationService,
//     GroupNotificationService groupNotificationService,
//     IFileService fileService,
//     IMessageService messageService,
//     IBackgroundTaskQueue taskQueue,
//     IServiceScopeFactory scopeFactory,
//     E2EEService e2EeService,
//     IUserCache userCache,
//     ResponseService responseService)
//     : BaseController<EncryptedMessageController>(context, logger, userCache, responseService)
// {
//     private readonly BlobServiceClient _blobServiceClient = blobServiceClient;
//     private readonly IHubContext<UserHub> _hubContext = hubContext;
//     private readonly IMessageNotificationService _messageNotificationService = messageNotificationService;
//     private readonly GroupNotificationService _groupNotificationService = groupNotificationService;
//     private readonly IMessageService _messageService = messageService;
//     private readonly IBackgroundTaskQueue _taskQueue = taskQueue;
//     private readonly IServiceScopeFactory _scopeFactory = scopeFactory;
//
//     [HttpPost("upload-encrypted-json")]
//     public async Task<IActionResult> UploadEncryptedJSON([FromBody] SendEncryptedMessageWithFilesRequestDTO request)
//     {
//         try
//         {
//             var userId = GetUserId();
//             if (userId == null)
//                 return Unauthorized("Invalid appUser ID");
//
//             if (request.EncryptedFilesData == null || !request.EncryptedFilesData.Any())
//                 return BadRequest("No encrypted files provided");
//
//             if (request.EncryptedFilesData.Count > 10)
//                 return BadRequest("Maximum 10 files per message");
//
//             // Validate conversation access
//             var hasAccess = await Context.ConversationParticipants
//                 .AnyAsync(cp => cp.ConversationId == request.ConversationId && cp.UserId == userId);
//             
//             
//             
//             if (!hasAccess)
//                 return Forbid("Not authorized for this conversation");
//             
//             Logger.LogInformation("🔐🐛 BACKEND RECEIVED: MessageKeyInfo={MessageKeyInfoCount}, AttachmentCount={AttachmentCount}", 
//                 !string.IsNullOrEmpty(request.TextKeyInfo) ? JsonSerializer.Deserialize<Dictionary<string, string>>(request.TextKeyInfo)?.Keys.Count ?? 0 : 0,
//                 request.EncryptedFilesData?.Count ?? 0);
//
//             // Log hver attachment som kommer inn
//             foreach (var fileData in request.EncryptedFilesData ?? new List<EncryptedFileDataRequestDto>())
//             {
//                 Logger.LogInformation("🔐🐛 INCOMING ATTACHMENT: {FileName}, KeyInfoKeys={KeyInfoCount}, ThumbnailKeyInfo={ThumbnailKeyInfoCount} keys, HasThumbnailData={HasThumbnailData}", 
//                     fileData.FileName, 
//                     fileData.KeyInfo?.Keys.Count ?? 0,
//                     fileData.ThumbnailKeyInfo?.Keys.Count ?? 0,
//                     !string.IsNullOrEmpty(fileData.EncryptedThumbnailData));
//             }
//             
//             var uploadedUrls = new List<string>();
//             var encryptedAttachments = new List<EncryptedAttachmentDto>();
//
//             try
//             {
//                 
//                 // Process each encrypted file
//                 foreach (var fileData in request.EncryptedFilesData)
//                 {
//                     
//                     // Validate base64 data for main file
//                     if (string.IsNullOrEmpty(fileData.EncryptedFileData))
//                         throw new ValidationException($"Missing encrypted data for file: {fileData.FileName}");
//
//                     // Convert base64 to bytes for blob upload
//                     byte[] encryptedBytes;
//                     try
//                     {
//                         encryptedBytes = Convert.FromBase64String(fileData.EncryptedFileData);
//                     }
//                     catch (FormatException)
//                     {
//                         throw new ValidationException($"Invalid base64 data for file: {fileData.FileName}");
//                     }
//
//                     if (encryptedBytes.Length == 0)
//                         throw new ValidationException($"Empty encrypted data for file: {fileData.FileName}");
//
//                     // Determine container based on file type
//                     var containerName = fileData.FileType.StartsWith("video/") 
//                         ? "encrypted-message-videos" 
//                         : "encrypted-message-attachments";
//
//                     // Generate unique filename for encrypted file
//                     var fileName = $"{Path.GetFileNameWithoutExtension(fileData.FileName)}_{Guid.NewGuid()}.enc";
//                     
//                     // Upload main encrypted file to blob storage
//                     var uploadedUrl = await fileService.UploadEncryptedBytesAsync(encryptedBytes, containerName, fileName);
//                     uploadedUrls.Add(uploadedUrl);
//
//                     // Process thumbnail if present
//                     string? thumbnailUrl = null;
//                     if (!string.IsNullOrEmpty(fileData.EncryptedThumbnailData))
//                     {
//                         try
//                         {
//                             // Validate and upload thumbnail
//                             var thumbnailBytes = Convert.FromBase64String(fileData.EncryptedThumbnailData);
//                             if (thumbnailBytes.Length > 0)
//                             {
//                                 var thumbnailFileName = $"thumb_{Path.GetFileNameWithoutExtension(fileData.FileName)}_{Guid.NewGuid()}.enc";
//                                 thumbnailUrl = await fileService.UploadEncryptedBytesAsync(
//                                     thumbnailBytes, 
//                                     "encrypted-thumbnails", 
//                                     thumbnailFileName);
//                                 uploadedUrls.Add(thumbnailUrl); // Track for cleanup
//
//                                 Logger.LogInformation("Thumbnail uploaded for {FileName}: {ThumbnailUrl} ({Width}x{Height}, {Size} bytes)", 
//                                     fileData.FileName, thumbnailUrl, fileData.ThumbnailWidth, fileData.ThumbnailHeight, thumbnailBytes.Length);
//                             }
//                         }
//                         catch (Exception ex)
//                         {
//                             Logger.LogWarning(ex, "Failed to process thumbnail for {FileName}, continuing without thumbnail", fileData.FileName);
//                             // Continue without thumbnail - ikke kritisk feil
//                         }
//                     }
//
//                     // Create attachment DTO with thumbnail data
//                     var encryptedAttachment = new EncryptedAttachmentDto
//                     {
//                         EncryptedFileUrl = uploadedUrl,
//                         FileName = fileData.FileName,
//                         FileType = fileData.FileType,
//                         FileSize = fileData.FileSize,
//                         KeyInfo = fileData.KeyInfo,
//                         IV = fileData.IV,
//                         Version = fileData.Version,
//     
//                         // Thumbnail data if available
//                         EncryptedThumbnailUrl = thumbnailUrl,
//                         ThumbnailKeyInfo = fileData.ThumbnailKeyInfo, // Direkte assignment - no JSON serialization needed
//                         ThumbnailIV = fileData.ThumbnailIV,
//                         ThumbnailWidth = fileData.ThumbnailWidth,
//                         ThumbnailHeight = fileData.ThumbnailHeight
//                     };
//                     
//                     Logger.LogInformation("🔐🐛 CREATED ATTACHMENT DTO: {FileName}, KeyInfoKeys={KeyInfoCount}, ThumbnailKeyInfo={ThumbnailKeyInfoCount} keys, ThumbnailUrl={HasThumbnailUrl}", 
//                         encryptedAttachment.FileName,
//                         encryptedAttachment.KeyInfo?.Keys.Count ?? 0,
//                         encryptedAttachment.ThumbnailKeyInfo?.Keys.Count ?? 0,
//                         !string.IsNullOrEmpty(encryptedAttachment.EncryptedThumbnailUrl));
//
//                     encryptedAttachments.Add(encryptedAttachment);
//
//                     var thumbnailInfo = thumbnailUrl != null 
//                         ? $" with thumbnail ({fileData.ThumbnailWidth}x{fileData.ThumbnailHeight})" 
//                         : "";
//                         
//                     Logger.LogInformation("Encrypted file uploaded: {FileName} -> {Url} ({Size} bytes){ThumbnailInfo}", 
//                         fileData.FileName, uploadedUrl, encryptedBytes.Length, thumbnailInfo);
//                 }
//
//                 // Create message request - resten av logikken forblir uendret
//                 var sendMessageRequest = new SendEncryptedMessageRequestDTO
//                 {
//                     EncryptedText = request.Text,
//                     ConversationId = request.ConversationId,
//                     ReceiverId = request.ReceiverId?.ToString(),
//                     ParentMessageId = request.ParentMessageId,
//                     KeyInfo = !string.IsNullOrEmpty(request.TextKeyInfo) 
//                         ? JsonSerializer.Deserialize<Dictionary<string, string>>(request.TextKeyInfo) ?? new Dictionary<string, string>()
//                         : new Dictionary<string, string>(),
//                     IV = request.TextIV ?? string.Empty,
//                     Version = 1,
//                     EncryptedAttachments = encryptedAttachments
//                 };
//                 
//                 Logger.LogInformation("🔐🐛 SENDING TO STORE: TextKeyInfo={TextKeyInfoCount}, AttachmentCount={AttachmentCount}", 
//                     sendMessageRequest.KeyInfo?.Keys.Count ?? 0,
//                     sendMessageRequest.EncryptedAttachments?.Count ?? 0);
//
//                 foreach (var att in sendMessageRequest.EncryptedAttachments ?? new List<EncryptedAttachmentDto>())
//                 {
//                     Logger.LogInformation("🔐🐛 STORE ATTACHMENT: {FileName}, KeyInfoKeys={KeyInfoCount}, ThumbnailKeyInfo={ThumbnailKeyInfoCount} keys", 
//                         att.FileName, 
//                         att.KeyInfo?.Keys.Count ?? 0,
//                         att.ThumbnailKeyInfo?.Keys.Count ?? 0);
//                 }
//
//                 // Store encrypted message with attachments
//                 var messageResult = await e2EeService.StoreEncryptedMessageAsync(sendMessageRequest, userId.Value);
//                 
//                 if (messageResult == null)
//                 {
//                     // Cleanup uploaded files if message creation fails
//                     await fileService.CleanupUploadedFiles(uploadedUrls);
//                     return StatusCode(500, "Failed to send encrypted message");
//                 }
//
//                 Logger.LogInformation("Encrypted message with {AttachmentCount} attachments sent successfully. MessageId: {MessageId}", 
//                     encryptedAttachments.Count, messageResult.Id);
//                 
//                 return Ok(new SendEncryptedMessageResponseDTO
//                 {
//                     MessageId = messageResult.Id,
//                     SentAt = messageResult.SentAt.ToString("O"), // ISO format
//                     ConversationId = messageResult.ConversationId,
//                     Attachments = request.EncryptedFilesData.Select((fileData, index) => new AttachmentResponseDto
//                     {
//                         Id = messageResult.Attachments.ElementAt(index).Id, // From database
//                         OptimisticId = fileData.OptimisticId ?? $"fallback_{index}", // Use original optimistic ID from frontend
//                         FileUrl = encryptedAttachments[index].EncryptedFileUrl,
//                         ThumbnailUrl = encryptedAttachments[index].EncryptedThumbnailUrl
//                     }).ToArray()
//                 });
//             }
//             catch (Exception)
//             {
//                 // Cleanup uploaded files on error
//                 if (uploadedUrls.Any())
//                 {
//                     await fileService.CleanupUploadedFiles(uploadedUrls);
//                 }
//                 throw;
//             }
//         }
//         catch (ValidationException ex)
//         {
//             Logger.LogWarning("Validation error uploading encrypted JSON: {Error}", ex.Message);
//             return BadRequest(ex.Message);
//         }
//         catch (Exception ex)
//         {
//             Logger.LogError(ex, "Error uploading encrypted JSON attachments for appUser {UserId}", GetUserId());
//             return StatusCode(500, "Internal server error");
//         }
//     }
//     
//     // [HttpPost("upload-encrypted-multipart")]
//     // [RequestSizeLimit(150_000_000)] // 150MB
//     // [RequestFormLimits(MultipartBodyLengthLimit = 150_000_000)]
//     // public async Task<IActionResult> UploadEncryptedMultipart([FromForm] EncryptedMultipartRequest request)
//     // {
//     //     var userId = GetUserId();
//     //     if (userId == null)
//     //         return Unauthorized("Invalid appUser ID");
//     //
//     //     if (request.EncryptedFiles == null || !request.EncryptedFiles.Any())
//     //         return BadRequest("No encrypted files provided");
//     //
//     //     if (request.EncryptedFiles.Count > 10)
//     //         return BadRequest("Maximum 10 files per message");
//     //
//     //     var hasAccess = await _context.ConversationParticipants
//     //         .AnyAsync(cp => cp.ConversationId == request.ConversationId && cp.UserId == userId);
//     //     
//     //     if (!hasAccess)
//     //         return Forbid("Not authorized for this conversation");
//     //
//     //     var uploadedUrls = new List<string>();
//     //     var encryptedAttachments = new List<EncryptedAttachmentDto>();
//     //
//     //     try
//     //     {
//     //         for (int i = 0; i < request.EncryptedFiles.Count; i++)
//     //         {
//     //             var file = request.EncryptedFiles[i];
//     //             var metadata = request.FileMetadata[i]; // JSON string med KeyInfo, IV, etc.
//     //             
//     //             var meta = JsonSerializer.Deserialize<FileMetadataDto>(metadata);
//     //             
//     //             // File er allerede kryptert binary data fra frontend
//     //             using var stream = file.OpenReadStream();
//     //             
//     //             var containerName = meta.FileType.StartsWith("video/") 
//     //                 ? "encrypted-message-videos" 
//     //                 : "encrypted-message-attachments";
//     //
//     //             var fileName = $"{Path.GetFileNameWithoutExtension(meta.FileName)}_{Guid.NewGuid()}.enc";
//     //             
//     //             // Upload direkte fra stream - ingen Base64 konvertering!
//     //             var uploadedUrl = await fileService.UploadEncryptedStreamAsync(stream, containerName, fileName);
//     //             uploadedUrls.Add(uploadedUrl);
//     //
//     //             // Process thumbnail hvis present
//     //             string? thumbnailUrl = null;
//     //             if (request.EncryptedThumbnails?.Count > i && request.EncryptedThumbnails[i] != null)
//     //             {
//     //                 var thumb = request.EncryptedThumbnails[i];
//     //                 using var thumbStream = thumb.OpenReadStream();
//     //                 var thumbnailFileName = $"thumb_{Path.GetFileNameWithoutExtension(meta.FileName)}_{Guid.NewGuid()}.enc";
//     //                 thumbnailUrl = await fileService.UploadEncryptedStreamAsync(thumbStream, "encrypted-thumbnails", thumbnailFileName);
//     //                 uploadedUrls.Add(thumbnailUrl);
//     //             }
//     //
//     //             var encryptedAttachment = new EncryptedAttachmentDto
//     //             {
//     //                 EncryptedFileUrl = uploadedUrl,
//     //                 FileName = meta.FileName,
//     //                 FileType = meta.FileType,
//     //                 FileSize = meta.FileSize,
//     //                 KeyInfo = meta.KeyInfo,
//     //                 IV = meta.IV,
//     //                 Version = meta.Version,
//     //                 EncryptedThumbnailUrl = thumbnailUrl,
//     //                 ThumbnailKeyInfo = meta.ThumbnailKeyInfo,
//     //                 ThumbnailIV = meta.ThumbnailIV,
//     //                 ThumbnailWidth = meta.ThumbnailWidth,
//     //                 ThumbnailHeight = meta.ThumbnailHeight
//     //             };
//     //
//     //             encryptedAttachments.Add(encryptedAttachment);
//     //         }
//     //
//     //         var sendMessageRequest = new SendEncryptedMessageRequestDTO
//     //         {
//     //             EncryptedText = request.Text,
//     //             ConversationId = request.ConversationId,
//     //             ReceiverId = request.ReceiverId?.ToString(),
//     //             ParentMessageId = request.ParentMessageId,
//     //             KeyInfo = request.TextKeyInfo != null 
//     //                 ? JsonSerializer.Deserialize<Dictionary<string, string>>(request.TextKeyInfo) ?? new()
//     //                 : new(),
//     //             IV = request.TextIV ?? string.Empty,
//     //             Version = 1,
//     //             EncryptedAttachments = encryptedAttachments
//     //         };
//     //
//     //         var messageResult = await e2EeService.StoreEncryptedMessageAsync(sendMessageRequest, userId.Value);
//     //         
//     //         if (messageResult == null)
//     //         {
//     //             await fileService.CleanupUploadedFiles(uploadedUrls);
//     //             return StatusCode(500, "Failed to send encrypted message");
//     //         }
//     //
//     //         return Ok(new SendEncryptedMessageResponseDTO
//     //         {
//     //             MessageId = messageResult.Id,
//     //             SentAt = messageResult.SentAt.ToString("O"),
//     //             ConversationId = messageResult.ConversationId,
//     //             Attachments = encryptedAttachments.Select((att, index) => new AttachmentResponseDto
//     //             {
//     //                 Id = messageResult.Attachments.ElementAt(index).Id,
//     //                 OptimisticId = request.OptimisticIds?[index],
//     //                 FileUrl = att.EncryptedFileUrl,
//     //                 ThumbnailUrl = att.EncryptedThumbnailUrl
//     //             }).ToArray()
//     //         });
//     //     }
//     //     catch (Exception)
//     //     {
//     //         if (uploadedUrls.Any())
//     //             await fileService.CleanupUploadedFiles(uploadedUrls);
//     //         throw;
//     //     }
//     // }
//     //
//     // public class EncryptedMultipartRequest
//     // {
//     //     public int ConversationId { get; set; }
//     //     public int? ReceiverId { get; set; }
//     //     public int? ParentMessageId { get; set; }
//     //
//     //     public string? Text { get; set; }
//     //     public string? TextKeyInfo { get; set; } // JSON
//     //     public string? TextIV { get; set; }
//     //
//     //     [Required]
//     //     public List<IFormFile> EncryptedFiles { get; set; } = new(); // Allerede kryptert binary
//     //
//     //     public List<IFormFile>? EncryptedThumbnails { get; set; }
//     //
//     //     [Required]
//     //     public List<string> FileMetadata { get; set; } = new(); // JSON strings med KeyInfo, IV, etc.
//     //
//     //     public List<string>? OptimisticIds { get; set; }
//     // }
//     //
//     // public class FileMetadataDto
//     // {
//     //     public string FileName { get; set; } = string.Empty;
//     //     public string FileType { get; set; } = string.Empty;
//     //     public long FileSize { get; set; }
//     //     public Dictionary<string, string> KeyInfo { get; set; } = new();
//     //     public string IV { get; set; } = string.Empty;
//     //     public int Version { get; set; }
//     //     public Dictionary<string, string>? ThumbnailKeyInfo { get; set; }
//     //     public string? ThumbnailIV { get; set; }
//     //     public int? ThumbnailWidth { get; set; }
//     //     public int? ThumbnailHeight { get; set; }
//     // }
// // }
//
//
//   // 🆕 Nytt endepunkt for message attachments
//     [HttpPost("upload-message-attachments")]
// public async Task<IActionResult> UploadMessageAttachments([FromForm] UploadAttachmentsRequestDTO request)
//     {
//         var senderId = GetUserId();
//         if (senderId == null)
//             return Unauthorized(new { message = "Ugyldig eller manglende bruker-ID i token." });
//
//         if (request.Files == null || request.Files.Count == 0)
//             return BadRequest(new { message = "Ingen filer oppgitt" });
//
//         if (request.Files.Count > 10)
//             return BadRequest(new { message = "Maksimalt 10 filer per melding" });
//         
    //     // 🆕 Økt total størrelse for å støtte videoer
    //     const long maxTotalSize = 100 * 1024 * 1024; // 100MB (økt fra 20MB)
    //     var totalSize = request.Files.Sum(f => f.Length);
    //     if (totalSize > maxTotalSize)
    //     {
    //         return BadRequest(new
    //         {
    //             message = $"Total størrelse for alle filer overstiger {maxTotalSize / (1024 * 1024)} MB"
    //         });
    //     }
    //
    //     // ✅ Valider alle filer først
    //     foreach (var file in request.Files)
    //     {
    //         var (isValid, errorMessage) = fileService.ValidateFile(file);
    //         if (!isValid)
    //             return BadRequest(new { message = $"Feil med fil '{file.FileName}': {errorMessage}" });
    //     }
    //     
    //     var uploadedFileUrls = new List<string>();
    //     try
    //     {
    //         // 🔧 FIKSET: Process filer i samme rekkefølge som de kom inn
    //         var uploadTasks = request.Files.Select(file => 
    //         {
    //             var containerName = file.ContentType.StartsWith("video/") 
    //                 ? "message-videos" 
    //                 : "message-attachments";
    //             return fileService.UploadFileAsync(file, containerName);
    //         });
    //
    //         uploadedFileUrls = (await Task.WhenAll(uploadTasks).ConfigureAwait(false)).ToList();
    //
    //         // ✅ Bygg attachments - nå matcher indeksene
    //         var attachments = request.Files.Select((file, index) => new AttachmentDto
    //         {
    //             FileUrl = uploadedFileUrls[index],
    //             FileType = file.ContentType,
    //             FileName = file.FileName,
    //             FileSize = file.Length
    //         }).ToList();
    //         
    //         // ✅ Send melding
    //         var sendMessageRequest = new SendMessageRequestDTO
    //         {
    //             Text = request.Text,
    //             Attachments = attachments,
    //             ConversationId = request.ConversationId,
    //             ReceiverId = request.ReceiverId,
    //             ParentMessageId = request.ParentMessageId
    //         };
    //         
    //         var response = await messageService.SendMessageAsync(senderId.Value, sendMessageRequest)
    //             .ConfigureAwait(false);
    //             
    //         return Ok(response);
    //     }
    //     catch (ValidationException ex)
    //     {
    //         Logger.LogWarning("Validation error when sending message for appUser {UserId}: {Error}", senderId, ex.Message);
    //         await fileService.CleanupUploadedFiles(uploadedFileUrls).ConfigureAwait(false);
    //         return BadRequest(new { message = ex.Message });
    //     }
    //     catch (InvalidOperationException ex)
    //     {
    //         Logger.LogWarning("Business logic error when sending message for appUser {UserId}: {Error}", senderId, ex.Message);
    //         await fileService.CleanupUploadedFiles(uploadedFileUrls).ConfigureAwait(false);
    //         return BadRequest(new { message = ex.Message });
    //     }
    //     catch (Exception ex)
    //     {
    //         Logger.LogError(ex, "Unexpected error when sending message for appUser {UserId}", senderId);
    //         await fileService.CleanupUploadedFiles(uploadedFileUrls).ConfigureAwait(false);
    //         return StatusCode(500, new { message = "Feil ved sending av melding" });
    //     }
    // }
