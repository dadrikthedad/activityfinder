using AFBack.Features.FileHandling.Enums;
namespace AFBack.Features.FileHandling.Services;

public class BlobUrlBuilder(
    IConfiguration configuration) : IBlobUrlBuilder
{
    private readonly string _baseUrl = configuration["Storage:BlobAccountUrl"]
                                       ?? throw new InvalidOperationException("Storage:BlobAccountUrl not configured");
    
    /// <summary>
    /// Henter buckets vi har i S3 ved oppstart.
    /// EncryptedFiles = enkrypterte filer, public URL
    /// PublicImages = åpne filer, profilimage, groupimage, etc. Alle kan se
    /// Private files = dokumenter kun for selskapets øyne. SupportsTickets etc
    /// </summary>
    private readonly Dictionary<BlobContainer, string> _containers = new()
    {
        [BlobContainer.EncryptedFiles] = configuration["Storage:Containers:EncryptedFiles"]
                                         ?? throw new InvalidOperationException(
                                             "Storage:Containers:EncryptedFiles not configured"),
        [BlobContainer.PublicImages] = configuration["Storage:Containers:PublicImages"]
                                       ?? throw new InvalidOperationException(
                                           "Storage:Containers:PublicImages not configured"),
        [BlobContainer.PrivateFiles] = configuration["Storage:Containers:PrivateFiles"]
                                       ?? throw new InvalidOperationException(
                                           "Storage:Containers:PrivateFiles not configured")
    };
    
    /// <inheritdoc/>
    public string GetBlobUrl(string storageKey, BlobContainer container)
        => $"{_baseUrl.TrimEnd('/')}/{_containers[container]}/{storageKey}";
    
    
    /// <summary>
    /// Henter container navnet fra appSettings utifra ønsket container
    /// </summary>
    /// <param name="container">Enum til type container</param>
    /// <returns>Container navnet som string</returns>
    public string GetContainerName(BlobContainer container) => _containers[container];
    
}
