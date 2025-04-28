using AFBack.Services;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.AspNetCore.Http;

public class FileService : IFileService
{
    private readonly BlobServiceClient _blobServiceClient;

    public FileService(BlobServiceClient blobServiceClient)
    {
        _blobServiceClient = blobServiceClient;
    }

    public async Task<string> UploadFileAsync(IFormFile file, string containerName)
    {
        if (file == null || file.Length == 0)
            throw new ArgumentException("Filen kan ikke være tom.", nameof(file));

        var containerClient = _blobServiceClient.GetBlobContainerClient(containerName);
        await containerClient.CreateIfNotExistsAsync(PublicAccessType.Blob); // Viktig: gjør blob offentlig lesbar

        var fileName = $"{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
        var blobClient = containerClient.GetBlobClient(fileName);

        using (var stream = file.OpenReadStream())
        {
            await blobClient.UploadAsync(stream, overwrite: true);
        }

        return blobClient.Uri.ToString(); // Returner URL som kan brukes i frontend
    }
}