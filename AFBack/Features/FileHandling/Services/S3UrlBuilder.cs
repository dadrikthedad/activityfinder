using AFBack.Configurations.Options;
using AFBack.Features.FileHandling.Enums;
using Microsoft.Extensions.Options;

namespace AFBack.Features.FileHandling.Services;

public class BlobUrlBuilder(
    IOptions<StorageOptions> storageOptions) : IBlobUrlBuilder
{
    private readonly string _baseUrl = storageOptions.Value.BlobAccountUrl;

    /// <summary>
    /// Henter buckets vi har i S3 ved oppstart.
    /// EncryptedFiles = enkrypterte filer, public URL
    /// PublicImages = åpne filer, profilimage, groupimage, etc. Alle kan se
    /// Private files = dokumenter kun for selskapets øyne. SupportsTickets etc
    /// </summary>
    private readonly Dictionary<BlobContainer, string> _containers = new()
    {
        [BlobContainer.EncryptedFiles] = storageOptions.Value.Containers.EncryptedFiles,
        [BlobContainer.PublicImages]   = storageOptions.Value.Containers.PublicImages,
        [BlobContainer.PrivateFiles]   = storageOptions.Value.Containers.PrivateFiles
    };

    /// <inheritdoc/>
    public string GetBlobUrl(string storageKey, BlobContainer container)
        => $"{_baseUrl.TrimEnd('/')}/{_containers[container]}/{storageKey}";

    /// <summary>
    /// Henter container navnet fra appSettings utifra ønsket container
    /// </summary>
    public string GetContainerName(BlobContainer container) => _containers[container];
}
