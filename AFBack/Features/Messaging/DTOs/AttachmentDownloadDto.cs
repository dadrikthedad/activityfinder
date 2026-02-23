namespace AFBack.Features.Messaging.DTOs;

/// <summary>
/// Intern DTO for å hente en attacahment sine Keys
/// </summary>
public class AttachmentDownloadDto
{
    public string EncryptedFileStorageKey { get; set; } = string.Empty;
    public string? EncryptedThumbnailStorageKey { get; set; }
}
