using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.AspNetCore.Http;

namespace AFBack.Services;


public interface IFileService
{
    Task<string> UploadFileAsync(IFormFile file, string containerName);
    Task<List<string>> UploadFilesAsync(IEnumerable<IFormFile> files, string containerName);
    Task DeleteFileAsync(string fileUrl);
    (bool IsValid, string? ErrorMessage) ValidateFile(IFormFile file);
    (bool IsValid, string? ErrorMessage) ValidateImage(IFormFile file);

    Task CleanupUploadedFiles(List<string> fileUrls);
    Task<string> UploadEncryptedBytesAsync(byte[] encryptedData, string containerName, string fileName);
}