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
    public static readonly HashSet<string> _allowedAttachmentTypes = new()
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

    // OPPDATERTE filstørrelsesbegrensninger
    private const long MaxFileSizeInBytes = 20 * 1024 * 1024; // 10MB per fil
    private const long MaxVideoSizeInBytes = 50 * 1024 * 1024; // 50MB for videoer
    private const long MaxTotalSizeInBytes = 100 * 1024 * 1024; // 100MB total (NY)

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

    // NY METODE: Valider flere filer samtidig med total størrelse
    public (bool IsValid, string? ErrorMessage) ValidateFiles(IEnumerable<IFormFile> files)
    {
        var fileList = files.ToList();
        
        if (!fileList.Any())
            return (false, "Ingen filer oppgitt");

        // Sjekk total størrelse
        var totalSize = fileList.Sum(f => f.Length);
        if (totalSize > MaxTotalSizeInBytes)
        {
            var maxSizeMB = MaxTotalSizeInBytes / (1024 * 1024);
            var totalSizeMB = totalSize / (1024.0 * 1024.0);
            return (false, $"Total størrelse ({totalSizeMB:F1}MB) overstiger maksimal tillatt størrelse ({maxSizeMB}MB)");
        }

        // Valider hver enkelt fil
        foreach (var file in fileList)
        {
            var (isValid, errorMessage) = ValidateFile(file);
            if (!isValid)
                return (false, errorMessage);
        }

        return (true, null);
    }

    public async Task<List<string>> UploadFilesAsync(IEnumerable<IFormFile> files, string containerName)
    {
        var fileList = files.ToList();
        
        // NY: Valider alle filer inkludert total størrelse før opplasting
        var (isValid, errorMessage) = ValidateFiles(fileList);
        if (!isValid)
            throw new ValidationException(errorMessage);

        var uploadTasks = fileList.Select(file => UploadFileAsync(file, containerName));
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

        // Forskjellige størrelsesbegrensninger for videoer
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
    
    /// <summary>
    /// Vi rydder opp og fjerner lastete filer hvis noe går galt
    /// </summary>
    /// <param name="urls">Urlene fra bloben</param>
    /// <param name="method">Metoden som kaller cleanup</param>
    /// <param name="userId">Brukeren for logging</param>
    public async Task TryCleanupFilesAsync(List<string> urls, string method, string userId)
    {
        if (urls.Count == 0)
            return;
        try
        {
            await CleanupUploadedFiles(urls);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex, "Failed to cleanup files after upload failed for appUser {UserId} in method {Method}", 
                userId, method);
        }
    }
    
    public async Task<string> UploadEncryptedBytesAsync(byte[] encryptedData, string containerName, string fileName)
    {
        var containerClient = _blobServiceClient.GetBlobContainerClient(containerName);
        await containerClient.CreateIfNotExistsAsync(PublicAccessType.Blob);
    
        var blobClient = containerClient.GetBlobClient(fileName);
    
        using var stream = new MemoryStream(encryptedData);
        await blobClient.UploadAsync(stream, new BlobHttpHeaders { ContentType = "application/octet-stream" });
    
        return blobClient.Uri.ToString();
    }
}
