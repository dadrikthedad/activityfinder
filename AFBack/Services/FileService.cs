using System.ComponentModel.DataAnnotations;
using AFBack.Services;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.AspNetCore.Http;

public class FileService : IFileService
{
    private readonly BlobServiceClient _blobServiceClient;
    private readonly ILogger<FileService> _logger;

    // Tillatte filtyper for vedlegg
    private readonly HashSet<string> _allowedAttachmentTypes = new()
    {
        "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
        "application/pdf", "text/plain", 
        "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "video/mp4", "video/mpeg", "video/quicktime", "video/x-msvideo",
        "video/webm", "video/ogg", "video/3gpp", "video/x-ms-wmv"
    };

    // Tillatte bildetyper (strengere for profilbilder osv)
    private readonly HashSet<string> _allowedImageTypes = new()
    {
        "image/jpeg", "image/png", "image/webp", "image/gif"
    };

    // Maks filstørrelse (10MB)
    private const long MaxFileSizeInBytes = 10 * 1024 * 1024;
    private const long MaxVideoSizeInBytes = 50 * 1024 * 1024;

    public FileService(BlobServiceClient blobServiceClient, ILogger<FileService> logger)
    {
        _blobServiceClient = blobServiceClient;
        _logger = logger;
    }

    public async Task<string> UploadFileAsync(IFormFile file, string containerName)
    {
        if (file == null || file.Length == 0)
            throw new ArgumentException("Filen kan ikke være tom.", nameof(file));

        // Valider fil før opplasting
        var (isValid, errorMessage) = ValidateFile(file);
        if (!isValid)
            throw new ValidationException(errorMessage);

        try
        {
            var containerClient = _blobServiceClient.GetBlobContainerClient(containerName);
            await containerClient.CreateIfNotExistsAsync(PublicAccessType.Blob);

            // Generer unikt filnavn med tidsstempel
            var fileName = GenerateUniqueFileName(file.FileName);
            var blobClient = containerClient.GetBlobClient(fileName);

            using var stream = file.OpenReadStream();
            await blobClient.UploadAsync(stream, new BlobHttpHeaders 
            { 
                ContentType = file.ContentType 
            });

            _logger.LogInformation("Fil lastet opp: {FileName} til container {ContainerName} ({FileSize} bytes)", 
                fileName, containerName, file.Length);

            return blobClient.Uri.ToString();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Feil ved opplasting av fil: {FileName} til container {ContainerName}", 
                file.FileName, containerName);
            throw new InvalidOperationException("Kunne ikke laste opp fil", ex);
        }
    }

    public async Task<List<string>> UploadFilesAsync(IEnumerable<IFormFile> files, string containerName)
    {
        var uploadTasks = files.Select(file => UploadFileAsync(file, containerName));
        var results = await Task.WhenAll(uploadTasks);
        return results.ToList();
    }

    public async Task DeleteFileAsync(string fileUrl)
    {
        try
        {
            var uri = new Uri(fileUrl);
            var pathSegments = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
            
            if (pathSegments.Length < 2) 
            {
                _logger.LogWarning("Ugyldig fil URL for sletting: {FileUrl}", fileUrl);
                return;
            }

            var containerName = pathSegments[0];
            var blobName = string.Join("/", pathSegments.Skip(1));

            var containerClient = _blobServiceClient.GetBlobContainerClient(containerName);
            var blobClient = containerClient.GetBlobClient(blobName);

            await blobClient.DeleteIfExistsAsync();
            _logger.LogInformation("Fil slettet: {FileUrl}", fileUrl);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Feil ved sletting av fil: {FileUrl}", fileUrl);
            // Ikke kast exception - fortsett selv om sletting feiler
        }
    }

    public (bool IsValid, string? ErrorMessage) ValidateFile(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return (false, "Ingen fil oppgitt");

        if (!_allowedAttachmentTypes.Contains(file.ContentType))
            return (false, $"Filtypen '{file.ContentType}' er ikke tillatt");

        if (string.IsNullOrWhiteSpace(file.FileName))
            return (false, "Filnavn er påkrevd");

        // 🆕 Forskjellige størrelsesbegrensninger for videoer
        var isVideo = file.ContentType.StartsWith("video/");
        var maxSize = isVideo ? MaxVideoSizeInBytes : MaxFileSizeInBytes;
        
        if (file.Length > maxSize)
        {
            var maxSizeMB = maxSize / (1024 * 1024);
            var fileType = isVideo ? "Video" : "Fil";
            return (false, $"{fileType} er for stor. Maksimal størrelse er {maxSizeMB}MB");
        }

        return (true, null);
    }

    public (bool IsValid, string? ErrorMessage) ValidateImage(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return (false, "Ingen fil oppgitt");

        if (!_allowedImageTypes.Contains(file.ContentType))
            return (false, "Kun bildefiler (jpg, png, webp, gif) er tillatt");

        if (file.Length > MaxFileSizeInBytes)
            return (false, $"Bildet er for stort. Maksimal størrelse er {MaxFileSizeInBytes / (1024 * 1024)}MB");

        return (true, null);
    }

    private string GenerateUniqueFileName(string originalFileName)
    {
        var extension = Path.GetExtension(originalFileName);
        var uniqueId = Guid.NewGuid().ToString("N");
        var timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
        
        return $"{timestamp}_{uniqueId}{extension}";
    }
    
    public async Task CleanupUploadedFiles(List<string> fileUrls)
    {
        if (fileUrls.Count == 0) return;
        _logger.LogInformation("Cleaning up {Count} uploaded files due to error", fileUrls.Count);
        var cleanupTasks = fileUrls.Select(async url =>
        {
            try
            {
                await DeleteFileAsync(url).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete file during cleanup: {FileUrl}", url);
            }
        });
        await Task.WhenAll(cleanupTasks).ConfigureAwait(false);
    }
}