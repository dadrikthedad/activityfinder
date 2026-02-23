namespace AFBack.Configurations.Options;

public static class EncryptedFileConfig
{
    /// <summary>
    /// Maks størrelse for krypterte filer (20 MB)
    /// Krypterte filer er noe større enn originalen pga. padding/overhead
    /// </summary>
    public const long MaxFileSizeBytes = 20 * 1024 * 1024;

    /// <summary>
    /// Maks størrelse for krypterte videofiler (50 MB)
    /// </summary>
    public const long MaxVideoSizeBytes = 50 * 1024 * 1024;

    /// <summary>
    /// Maks størrelse for krypterte thumbnails (2 MB)
    /// </summary>
    public const long MaxThumbnailSizeBytes = 2 * 1024 * 1024;

    /// <summary>
    /// Maks total størrelse for alle attachments i én melding (200 MB)
    /// </summary>
    public const long MaxTotalAttachmentSizeBytes = 200 * 1024 * 1024;

    /// <summary>
    /// Maks antall attachments per melding
    /// </summary>
    public const int MaxAttachmentsPerMessage = 10;
}
