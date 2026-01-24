using AFBack.Features.Messaging.DTOs.Request;

namespace AFBack.Features.Messaging.DTOs;

/// <summary>
/// Lagrer et opplastet attachment som en DTO
/// </summary>
public class UploadedAttachmentDto
{
    public string EncryptedFileUrl { get; set; } = string.Empty;
    public string EncryptedThumbnailUrl { get; set; } = string.Empty;
    public AttachmentRequest AttachmentRequest { get; set; } = null!;
}
