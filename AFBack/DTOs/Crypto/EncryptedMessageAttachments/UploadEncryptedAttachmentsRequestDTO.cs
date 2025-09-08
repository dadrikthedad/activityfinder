namespace AFBack.DTOs.Crypto.EncryptedMessageAttachments;

public class UploadEncryptedAttachmentsRequestDTO
{
    public List<IFormFile> EncryptedFiles { get; set; } = new();
    public List<EncryptedAttachmentDto> AttachmentMetadata { get; set; } = new(); // Bruker eksisterende DTO
    public string? AttachmentMetadataJson { get; set; }
    public string? Text { get; set; }
    public string? TextKeyInfo { get; set; }
    public string? TextIV { get; set; }
    public int? ConversationId { get; set; }
    public int? ReceiverId { get; set; }
    public int? ParentMessageId { get; set; }
}

public class UploadEncryptedAttachmentsResponseDTO
{
    public List<EncryptedAttachmentDto> AttachmentResults { get; set; } = new(); // Bruker eksisterende DTO
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
}