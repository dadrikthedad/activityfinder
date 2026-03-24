using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Features.FileHandling.Enums;
using AFBack.Features.FileHandling.Helpers;
using AFBack.Features.FileHandling.Validators;
using AFBack.Features.Messaging.DTOs;
using AFBack.Features.Support.Models;

namespace AFBack.Features.FileHandling.Services;

public class FileOrchestrator(
    IFileValidator fileValidator,
    IStorageService storageService,
    ILogger<FileOrchestrator> logger) : IFileOrchestrator
{
    
    // ======================== Last opp ======================== 
    
    /// <inheritdoc/>
    public async Task<Result<string>> UploadPublicImageAsync(IFormFile image, string storageKey, 
        CancellationToken ct = default)
    {
        // Validerer filen
        var validateImageResult = fileValidator.ValidateImage(image);
        if (validateImageResult.IsFailure)
            return Result<string>.Failure(validateImageResult.Error, validateImageResult.ErrorCode);
        
        // Åpner streamen
        await using var stream = image.OpenReadStream();
        
        // Laster opp bilde
        var uploadImageResult = await storageService.UploadAsync(stream, storageKey, image.ContentType,
            BlobContainer.PublicImages, null, ct);
        if (uploadImageResult.IsFailure)
            return Result<string>.Failure(uploadImageResult.Error, uploadImageResult.ErrorCode);

        return Result<string>.Success(uploadImageResult.Value!);
    }
    
    /// <inheritdoc/>
    public async Task<Result> UploadEncryptedFileAsync(byte[] encryptedData, string storageKey, 
        long maxSizeInBytes, CancellationToken ct = default)
    {
        if (encryptedData.Length == 0)
            return Result.Failure("File data is empty", AppErrorCode.Validation);
    
        if (encryptedData.Length > maxSizeInBytes)
        {
            var maxFormatted = FileHelper.FormatFileSize(maxSizeInBytes);
            return Result.Failure($"File size exceeds maximum allowed size ({maxFormatted})", 
                AppErrorCode.Validation);
        }
    
        using var stream = new MemoryStream(encryptedData);
    
        var uploadResult = await storageService.UploadAsync(stream, storageKey, 
            "application/octet-stream", BlobContainer.EncryptedFiles, null, ct);
        if (uploadResult.IsFailure)
            return Result.Failure(uploadResult.Error, uploadResult.ErrorCode);

        return Result.Success();
    }
    
    /// <inheritdoc/>
    public async Task<Result<SupportAttachment>> UploadSupportAttachmentAsync(IFormFile file, 
        CancellationToken ct = default)
    {
        // Validerer filen
        var validationResult = fileValidator.ValidateSupportAttachment(file);
        if (validationResult.IsFailure)
            return Result<SupportAttachment>.Failure(validationResult.Error, validationResult.ErrorCode);

        // Oppretter storageKey
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var storageKey = $"support-attachments/{Guid.NewGuid()}{extension}";

        // Åpner stream og laster opp
        await using var stream = file.OpenReadStream();
        var uploadResult = await storageService.UploadAsync(stream, storageKey, file.ContentType, 
            BlobContainer.PrivateFiles, null, ct);

        if (uploadResult.IsFailure)
        {
            logger.LogError("Failed to upload support attachment: {FileName}", file.FileName);
            return Result<SupportAttachment>.Failure("Failed to upload attachment", AppErrorCode.InternalError);
        }

        return Result<SupportAttachment>.Success(new SupportAttachment
        {
            OriginalFileName = file.FileName,
            ContentType = file.ContentType,
            FileExtension = extension,
            FileSize = file.Length,
            StorageKey = storageKey
        });
    }

    
    // ======================== Hent URL ======================== 
    
    /// <inheritdoc/>
    public async Task<List<AttachmentResponse>> ResolveAttachmentUrlsAsync(List<AttachmentResponse> attachments, 
        CancellationToken ct = default)
    {
        if (attachments.Count == 0)
            return attachments;
        
        foreach (var attachment in attachments)
        {
            // Oppretter en SAS URL for hver enkelte fil
            var fileUrlResult = await storageService.GenerateDownloadUrlAsync(attachment.EncryptedFileUrl, 
                BlobContainer.EncryptedFiles, ct);
            if (fileUrlResult.IsFailure) // Feil stille, 
                logger.LogError("Failed to generate SAS URL for attachment: {StorageKey}. Error: {Error}",
                    attachment.EncryptedFileUrl, fileUrlResult.Error);
            else
                attachment.EncryptedFileUrl = fileUrlResult.Value!;

            if (!string.IsNullOrEmpty(attachment.EncryptedThumbnailUrl))
            {
                var thumbUrlResult = await storageService.GenerateDownloadUrlAsync(
                    attachment.EncryptedThumbnailUrl, BlobContainer.EncryptedFiles, ct);
                if (thumbUrlResult.IsFailure) // Feil stille, 
                    logger.LogError("Failed to generate SAS URL for thumbnail: {StorageKey}. Error: {Error}",
                        attachment.EncryptedThumbnailUrl, thumbUrlResult.Error);
                else
                    attachment.EncryptedThumbnailUrl = thumbUrlResult.Value!;
            }
        }

        return attachments;
    }
    
    /// <inheritdoc/>
    public async Task<Result> DeletePublicImageAsync(string storageKey, CancellationToken ct = default) =>
    await storageService.DeleteAsync(storageKey, BlobContainer.PublicImages, ct);
    
    // ======================== CleanUp ======================== 
    
    /// <inheritdoc/>
    public async Task TryCleanupFilesAsync(List<string> storageKeys, BlobContainer container, 
        CancellationToken ct = default)
    {
        if (storageKeys.Count == 0)
            return; 
        
        foreach (var key in storageKeys)
        {
            await storageService.DeleteAsync(key, container, ct);
        }
    }
    
    
}
