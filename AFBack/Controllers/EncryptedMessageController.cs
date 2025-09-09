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
        E2EEService e2eeService)
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
        _ee2eService = e2eeService;
    }
    
    [HttpPost("upload-encrypted-attachments")]
    public async Task<IActionResult> UploadEncryptedAttachments([FromForm] UploadEncryptedAttachmentsRequestDTO request)
    {
        try
        {
            var userId = GetUserId();
            if (userId == null)
                return Unauthorized("Invalid user ID");

            if (request.EncryptedFiles == null || !request.EncryptedFiles.Any())
                return BadRequest("No files provided");

            if (request.EncryptedFiles.Count != request.AttachmentMetadata.Count)
                return BadRequest("Mismatch between files and metadata count");

            if (request.EncryptedFiles.Count > 10)
                return BadRequest("Maximum 10 files per message");
            
            // Parse JSON metadata hvis det kommer som string
            if (!string.IsNullOrEmpty(request.AttachmentMetadataJson))
            {
                request.AttachmentMetadata = JsonSerializer.Deserialize<List<EncryptedAttachmentDto>>(
                    request.AttachmentMetadataJson) ?? new List<EncryptedAttachmentDto>();
            }

            // Validate total size (encrypted files will be slightly larger)
            var totalSize = request.EncryptedFiles.Sum(f => f.Length);
            const long maxTotalSize = 120 * 1024 * 1024; // 120MB for encrypted files (20MB overhead)
            
            if (totalSize > maxTotalSize)
            {
                return BadRequest($"Total size exceeds {maxTotalSize / (1024 * 1024)} MB");
            }

            // Validate conversation access if applicable
            if (request.ConversationId.HasValue)
            {
                var hasAccess = await _context.ConversationParticipants
                    .AnyAsync(cp => cp.ConversationId == request.ConversationId && cp.UserId == userId);
                
                if (!hasAccess)
                    return Forbid("Not authorized for this conversation");
            }

            var uploadResults = new List<EncryptedAttachmentDto>();
            var uploadedUrls = new List<string>();

            try
            {
                // Upload encrypted files
                for (int i = 0; i < request.EncryptedFiles.Count; i++)
                {
                    var encryptedFile = request.EncryptedFiles[i];
                    var metadata = request.AttachmentMetadata[i];

                    // Validate encrypted file
                    if (encryptedFile.Length == 0)
                        throw new ValidationException($"Encrypted file {i} is empty");

                    // Determine container based on original file type
                    var containerName = metadata.FileType.StartsWith("video/") 
                        ? "encrypted-message-videos" 
                        : "encrypted-message-attachments";

                    // Upload encrypted file with .enc extension
                    var encryptedFileName = $"{Path.GetFileNameWithoutExtension(metadata.FileName)}.enc";
                    var uploadedUrl = await _fileService.UploadFileAsync(encryptedFile, containerName);
                    uploadedUrls.Add(uploadedUrl);

                    uploadResults.Add(new EncryptedAttachmentDto
                    {
                        EncryptedFileUrl = uploadedUrl,
                        FileName = metadata.FileName,
                        FileType = metadata.FileType,
                        FileSize = metadata.FileSize,
                        KeyInfo = metadata.KeyInfo,
                        IV = metadata.IV,
                        Version = metadata.Version
                    });
                }

                // If this is just uploading attachments without sending message, return results
                if (string.IsNullOrEmpty(request.Text) && !request.ConversationId.HasValue && !request.ReceiverId.HasValue)
                {
                    return Ok(new UploadEncryptedAttachmentsResponseDTO
                    {
                        AttachmentResults = uploadResults,
                        Success = true
                    });
                }

                // Send encrypted message with attachments
                var sendMessageRequest = new SendEncryptedMessageRequestDTO
                {
                    EncryptedText = request.Text, // Already encrypted from frontend
                    ConversationId = request.ConversationId,
                    ReceiverId = request.ReceiverId?.ToString(),
                    ParentMessageId = request.ParentMessageId,
                    KeyInfo = !string.IsNullOrEmpty(request.TextKeyInfo) 
                        ? JsonSerializer.Deserialize<Dictionary<string, string>>(request.TextKeyInfo) ?? new Dictionary<string, string>()
                        : new Dictionary<string, string>(),
                    IV = request.TextIV ?? string.Empty,
                    Version = 1,
                    EncryptedAttachments = uploadResults // Direkte bruk av uploadResults siden det allerede er EncryptedAttachmentDto
                };

                var messageResult = await _ee2eService.StoreEncryptedMessageAsync(sendMessageRequest, userId.Value);
                
                if (messageResult == null)
                {
                    await _fileService.CleanupUploadedFiles(uploadedUrls);
                    return StatusCode(500, "Failed to send encrypted message");
                }

                return Ok(new
                {
                    message = "Encrypted message with attachments sent successfully",
                    messageId = messageResult.Id,
                    attachmentCount = uploadResults.Count
                });
            }
            catch (Exception)
            {
                // Cleanup uploaded files on error
                await _fileService.CleanupUploadedFiles(uploadedUrls);
                throw;
            }
        }
        catch (ValidationException ex)
        {
            _logger.LogWarning("Validation error uploading encrypted attachments: {Error}", ex.Message);
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading encrypted attachments");
            return StatusCode(500, "Internal server error");
        }
    }

    // Services/FileService.cs - Legg til denne metoden
    public async Task<string> UploadEncryptedFileAsync(IFormFile encryptedFile, string containerName, string fileName)
    {
        if (encryptedFile == null || encryptedFile.Length == 0)
            throw new ArgumentException("Encrypted file cannot be empty.", nameof(encryptedFile));

        try
        {
            var containerClient = _blobServiceClient.GetBlobContainerClient(containerName);
            await containerClient.CreateIfNotExistsAsync(PublicAccessType.Blob);

            // Use provided filename for encrypted files
            var blobClient = containerClient.GetBlobClient(fileName);

            using var stream = encryptedFile.OpenReadStream();
            await blobClient.UploadAsync(stream, new BlobHttpHeaders 
            { 
                ContentType = "application/octet-stream" // All encrypted files are binary
            });

            _logger.LogInformation("Encrypted file uploaded: {FileName} to container {ContainerName} ({FileSize} bytes)", 
                fileName, containerName, encryptedFile.Length);

            return blobClient.Uri.ToString();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading encrypted file: {FileName} to container {ContainerName}", 
                fileName, containerName);
            throw new InvalidOperationException("Could not upload encrypted file", ex);
        }
    }

    // Validation for encrypted files
    public (bool IsValid, string? ErrorMessage) ValidateEncryptedFile(IFormFile encryptedFile, long originalFileSize, string originalContentType)
    {
        if (encryptedFile == null || encryptedFile.Length == 0)
            return (false, "No encrypted file provided");

        // Encrypted files should be slightly larger than original due to encryption overhead
        var expectedMinSize = originalFileSize;
        var expectedMaxSize = originalFileSize + (64 * 1024); // 64KB overhead should be enough

        if (encryptedFile.Length < expectedMinSize || encryptedFile.Length > expectedMaxSize)
            return (false, "Encrypted file size doesn't match expected range");

        // Validate original content type against allowed types
        if (!FileService._allowedAttachmentTypes.Contains(originalContentType))
            return (false, $"Original file type '{originalContentType}' is not allowed");

        return (true, null);
    }
    
    [HttpPost("upload-encrypted-json")]
    public async Task<IActionResult> UploadEncryptedJSON([FromBody] UploadEncryptedJSONRequestDTO request)
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

            var uploadedUrls = new List<string>();
            var encryptedAttachments = new List<EncryptedAttachmentDto>();

            try
            {
                // Process each encrypted file
                foreach (var fileData in request.EncryptedFilesData)
                {
                    // Validate base64 data
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
                    
                    // Upload encrypted bytes to blob storage
                    var uploadedUrl = await _fileService.UploadEncryptedBytesAsync(encryptedBytes, containerName, fileName);
                    uploadedUrls.Add(uploadedUrl);

                    // Add to encrypted attachments list
                    encryptedAttachments.Add(new EncryptedAttachmentDto
                    {
                        EncryptedFileUrl = uploadedUrl,
                        FileName = fileData.FileName,
                        FileType = fileData.FileType,
                        FileSize = fileData.FileSize,
                        KeyInfo = fileData.KeyInfo,
                        IV = fileData.IV,
                        Version = fileData.Version
                    });

                    _logger.LogInformation("Encrypted file uploaded: {FileName} -> {Url} ({Size} bytes)", 
                        fileData.FileName, uploadedUrl, encryptedBytes.Length);
                }

                // Create message request
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

                return Ok(new
                {
                    message = "Encrypted message with attachments sent successfully",
                    messageId = messageResult.Id,
                    attachmentCount = encryptedAttachments.Count,
                    attachments = encryptedAttachments.Select(a => new {
                        fileName = a.FileName,
                        fileType = a.FileType,
                        encryptedFileUrl = a.EncryptedFileUrl
                    })
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