using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.AspNetCore.Http;

namespace AFBack.Services;

public interface IFileService
{
    Task<string> UploadFileAsync(IFormFile file, string containerName);
}

