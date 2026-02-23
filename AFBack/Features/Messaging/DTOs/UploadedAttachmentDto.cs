using AFBack.Features.Messaging.DTOs.Request;

namespace AFBack.Features.Messaging.DTOs;

/// <summary>
/// Lagrer et opplastet attachment som en DTO
/// </summary>
public class UploadedAttachmentDto
{
    public string EncryptedFileStorageKey { get; set; } = string.Empty;
    public string EncryptedThumbnailStorageKey { get; set; } = string.Empty;
    public AttachmentRequest AttachmentRequest { get; set; } = null!;
}
