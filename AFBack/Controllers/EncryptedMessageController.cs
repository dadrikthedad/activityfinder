using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using AFBack.Data;
using AFBack.DTOs.Crypto;
using AFBack.DTOs.Crypto.EncryptedMessageAttachments;
using AFBack.Hubs;
using AFBack.Services;
using AFBack.Services.Crypto;
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
public class EncryptedMessageController : BaseController
{
    private readonly ILogger<FileController> _logger;
    private readonly BlobServiceClient _blobServiceClient;
    private readonly IHubContext<UserHub> _hubContext;
    private readonly MessageNotificationService _messageNotificationService;
    private readonly GroupNotificationService _groupNotificationService;
    private readonly IFileService _fileService;
    private readonly IMessageService _messageService;
    private readonly IBackgroundTaskQueue _taskQueue;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly E2EEService _ee2eService;

    public EncryptedMessageController(ApplicationDbContext context,
        ILogger<FileController> logger,
        BlobServiceClient blobServiceClient,
        IHubContext<UserHub> hubContext,
        MessageNotificationService messageNotificationService,
        GroupNotificationService groupNotificationService,
        IFileService fileService,
        IMessageService messageService,
        IBackgroundTaskQueue taskQueue,
        IServiceScopeFactory scopeFactory,
        E2EEService e2eeService) : base(context)
    {
        _logger = logger;
        _hubContext = hubContext;
        _blobServiceClient = blobServiceClient;
        _messageNotificationService = messageNotificationService;
        _groupNotificationService = groupNotificationService;
        _fileService = fileService;
        _messageService = messageService;
        _taskQueue = taskQueue;
        _scopeFactory = scopeFactory;
        _ee2eService = e2eeService;
    }

    [HttpPost("upload-encrypted-json")]
    public async Task<IActionResult> UploadEncryptedJSON([FromBody] SendEncryptedMessageWithFilesRequestDTO request)
    {
        try
        {
            var userId = GetUserId();
            if (userId == null)
                return Unauthorized("Invalid user ID");

            if (request.EncryptedFilesData == null || !request.EncryptedFilesData.Any())
                return BadRequest("No encrypted files provided");

            if (request.EncryptedFilesData.Count > 10)
                return BadRequest("Maximum 10 files per message");

            // Validate conversation access
            var hasAccess = await _context.ConversationParticipants
                .AnyAsync(cp => cp.ConversationId == request.ConversationId && cp.UserId == userId);
            
            if (!hasAccess)
                return Forbid("Not authorized for this conversation");
            
            _logger.LogInformation("🔐🐛 BACKEND RECEIVED: MessageKeyInfo={MessageKeyInfoCount}, AttachmentCount={AttachmentCount}", 
                !string.IsNullOrEmpty(request.TextKeyInfo) ? JsonSerializer.Deserialize<Dictionary<string, string>>(request.TextKeyInfo)?.Keys.Count ?? 0 : 0,
                request.EncryptedFilesData?.Count ?? 0);

            // Log hver attachment som kommer inn
            foreach (var fileData in request.EncryptedFilesData ?? new List<EncryptedFileDataRequestDto>())
            {
                _logger.LogInformation("🔐🐛 INCOMING ATTACHMENT: {FileName}, KeyInfoKeys={KeyInfoCount}, ThumbnailKeyInfo={ThumbnailKeyInfoCount} keys, HasThumbnailData={HasThumbnailData}", 
                    fileData.FileName, 
                    fileData.KeyInfo?.Keys.Count ?? 0,
                    fileData.ThumbnailKeyInfo?.Keys.Count ?? 0,
                    !string.IsNullOrEmpty(fileData.EncryptedThumbnailData));
            }
            
            

            var uploadedUrls = new List<string>();
            var encryptedAttachments = new List<EncryptedAttachmentDto>();

            try
            {
                
                // Process each encrypted file
                foreach (var fileData in request.EncryptedFilesData)
                {
                    
                    // Validate base64 data for main file
                    if (string.IsNullOrEmpty(fileData.EncryptedFileData))
                        throw new ValidationException($"Missing encrypted data for file: {fileData.FileName}");

                    // Convert base64 to bytes for blob upload
                    byte[] encryptedBytes;
                    try
                    {
                        encryptedBytes = Convert.FromBase64String(fileData.EncryptedFileData);
                    }
                    catch (FormatException)
                    {
                        throw new ValidationException($"Invalid base64 data for file: {fileData.FileName}");
                    }

                    if (encryptedBytes.Length == 0)
                        throw new ValidationException($"Empty encrypted data for file: {fileData.FileName}");

                    // Determine container based on file type
                    var containerName = fileData.FileType.StartsWith("video/") 
                        ? "encrypted-message-videos" 
                        : "encrypted-message-attachments";

                    // Generate unique filename for encrypted file
                    var fileName = $"{Path.GetFileNameWithoutExtension(fileData.FileName)}_{Guid.NewGuid()}.enc";
                    
                    // Upload main encrypted file to blob storage
                    var uploadedUrl = await _fileService.UploadEncryptedBytesAsync(encryptedBytes, containerName, fileName);
                    uploadedUrls.Add(uploadedUrl);

                    // Process thumbnail if present
                    string? thumbnailUrl = null;
                    if (!string.IsNullOrEmpty(fileData.EncryptedThumbnailData))
                    {
                        try
                        {
                            // Validate and upload thumbnail
                            var thumbnailBytes = Convert.FromBase64String(fileData.EncryptedThumbnailData);
                            if (thumbnailBytes.Length > 0)
                            {
                                var thumbnailFileName = $"thumb_{Path.GetFileNameWithoutExtension(fileData.FileName)}_{Guid.NewGuid()}.enc";
                                thumbnailUrl = await _fileService.UploadEncryptedBytesAsync(
                                    thumbnailBytes, 
                                    "encrypted-thumbnails", 
                                    thumbnailFileName);
                                uploadedUrls.Add(thumbnailUrl); // Track for cleanup

                                _logger.LogInformation("Thumbnail uploaded for {FileName}: {ThumbnailUrl} ({Width}x{Height}, {Size} bytes)", 
                                    fileData.FileName, thumbnailUrl, fileData.ThumbnailWidth, fileData.ThumbnailHeight, thumbnailBytes.Length);
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Failed to process thumbnail for {FileName}, continuing without thumbnail", fileData.FileName);
                            // Continue without thumbnail - ikke kritisk feil
                        }
                    }

                    // Create attachment DTO with thumbnail data
                    var encryptedAttachment = new EncryptedAttachmentDto
                    {
                        EncryptedFileUrl = uploadedUrl,
                        FileName = fileData.FileName,
                        FileType = fileData.FileType,
                        FileSize = fileData.FileSize,
                        KeyInfo = fileData.KeyInfo,
                        IV = fileData.IV,
                        Version = fileData.Version,
    
                        // Thumbnail data if available
                        EncryptedThumbnailUrl = thumbnailUrl,
                        ThumbnailKeyInfo = fileData.ThumbnailKeyInfo, // Direkte assignment - no JSON serialization needed
                        ThumbnailIV = fileData.ThumbnailIV,
                        ThumbnailWidth = fileData.ThumbnailWidth,
                        ThumbnailHeight = fileData.ThumbnailHeight
                    };
                    
                    _logger.LogInformation("🔐🐛 CREATED ATTACHMENT DTO: {FileName}, KeyInfoKeys={KeyInfoCount}, ThumbnailKeyInfo={ThumbnailKeyInfoCount} keys, ThumbnailUrl={HasThumbnailUrl}", 
                        encryptedAttachment.FileName,
                        encryptedAttachment.KeyInfo?.Keys.Count ?? 0,
                        encryptedAttachment.ThumbnailKeyInfo?.Keys.Count ?? 0,
                        !string.IsNullOrEmpty(encryptedAttachment.EncryptedThumbnailUrl));

                    encryptedAttachments.Add(encryptedAttachment);

                    var thumbnailInfo = thumbnailUrl != null 
                        ? $" with thumbnail ({fileData.ThumbnailWidth}x{fileData.ThumbnailHeight})" 
                        : "";
                        
                    _logger.LogInformation("Encrypted file uploaded: {FileName} -> {Url} ({Size} bytes){ThumbnailInfo}", 
                        fileData.FileName, uploadedUrl, encryptedBytes.Length, thumbnailInfo);
                }

                // Create message request - resten av logikken forblir uendret
                var sendMessageRequest = new SendEncryptedMessageRequestDTO
                {
                    EncryptedText = request.Text,
                    ConversationId = request.ConversationId,
                    ReceiverId = request.ReceiverId?.ToString(),
                    ParentMessageId = request.ParentMessageId,
                    KeyInfo = !string.IsNullOrEmpty(request.TextKeyInfo) 
                        ? JsonSerializer.Deserialize<Dictionary<string, string>>(request.TextKeyInfo) ?? new Dictionary<string, string>()
                        : new Dictionary<string, string>(),
                    IV = request.TextIV ?? string.Empty,
                    Version = 1,
                    EncryptedAttachments = encryptedAttachments
                };
                
                _logger.LogInformation("🔐🐛 SENDING TO STORE: TextKeyInfo={TextKeyInfoCount}, AttachmentCount={AttachmentCount}", 
                    sendMessageRequest.KeyInfo?.Keys.Count ?? 0,
                    sendMessageRequest.EncryptedAttachments?.Count ?? 0);

                foreach (var att in sendMessageRequest.EncryptedAttachments ?? new List<EncryptedAttachmentDto>())
                {
                    _logger.LogInformation("🔐🐛 STORE ATTACHMENT: {FileName}, KeyInfoKeys={KeyInfoCount}, ThumbnailKeyInfo={ThumbnailKeyInfoCount} keys", 
                        att.FileName, 
                        att.KeyInfo?.Keys.Count ?? 0,
                        att.ThumbnailKeyInfo?.Keys.Count ?? 0);
                }

                // Store encrypted message with attachments
                var messageResult = await _ee2eService.StoreEncryptedMessageAsync(sendMessageRequest, userId.Value);
                
                if (messageResult == null)
                {
                    // Cleanup uploaded files if message creation fails
                    await _fileService.CleanupUploadedFiles(uploadedUrls);
                    return StatusCode(500, "Failed to send encrypted message");
                }

                _logger.LogInformation("Encrypted message with {AttachmentCount} attachments sent successfully. MessageId: {MessageId}", 
                    encryptedAttachments.Count, messageResult.Id);
                
                return Ok(new SendEncryptedMessageResponseDTO
                {
                    MessageId = messageResult.Id,
                    SentAt = messageResult.SentAt.ToString("O"), // ISO format
                    ConversationId = messageResult.ConversationId,
                    Attachments = request.EncryptedFilesData.Select((fileData, index) => new AttachmentResponseDto
                    {
                        Id = messageResult.Attachments.ElementAt(index).Id, // From database
                        OptimisticId = fileData.OptimisticId ?? $"fallback_{index}", // Use original optimistic ID from frontend
                        FileUrl = encryptedAttachments[index].EncryptedFileUrl,
                        ThumbnailUrl = encryptedAttachments[index].EncryptedThumbnailUrl
                    }).ToArray()
                });
            }
            catch (Exception)
            {
                // Cleanup uploaded files on error
                if (uploadedUrls.Any())
                {
                    await _fileService.CleanupUploadedFiles(uploadedUrls);
                }
                throw;
            }
        }
        catch (ValidationException ex)
        {
            _logger.LogWarning("Validation error uploading encrypted JSON: {Error}", ex.Message);
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading encrypted JSON attachments for user {UserId}", GetUserId());
            return StatusCode(500, "Internal server error");
        }
    }
}