using AFBack.Features.FileHandling.Enums;
using Azure.Storage.Blobs;

namespace AFBack.Features.FileHandling.Services;

public class BlobUrlBuilder(
    BlobServiceClient blobServiceClient,
    IConfiguration configuration) : IBlobUrlBuilder
{
    private readonly string _baseUrl = blobServiceClient.Uri.ToString().TrimEnd('/');
    
    /// <summary>
    /// Henter containerene vi har i Blob Storage ved oppstart.
    /// EncryptedFiles = enkrypterte filer, bruker SAS Url
    /// PublicImages = åpne filer, profilimage, groupimage, etc. Alle kan se
    /// </summary>
    private readonly Dictionary<BlobContainer, string> _containers = new()
    {
        [BlobContainer.EncryptedFiles] = configuration["Azure:Containers:EncryptedFiles"]
                                         ?? throw new InvalidOperationException(
                                             "Azure:Containers:EncryptedFiles not configured"),
        [BlobContainer.PublicImages] = configuration["Azure:Containers:PublicImages"]
                                       ?? throw new InvalidOperationException(
                                           "Azure:Containers:PublicImages not configured"),
        [BlobContainer.PrivateFiles] = configuration["Azure:Containers:PrivateFiles"]
                                       ?? throw new InvalidOperationException(
                                           "Azure:Containers:PrivateFiles not configured"),
    };
    
    /// <inheritdoc/>
    public string GetBlobUrl(string storageKey, BlobContainer container)
        => $"{_baseUrl}/{_containers[container]}/{storageKey}";
    
    
    /// <summary>
    /// Henter container navnet fra appSettings utifra ønsket container
    /// </summary>
    /// <param name="container">Enum til type container</param>
    /// <returns>Container navnet som string</returns>
    public string GetContainerName(BlobContainer container) => _containers[container];
    
}
