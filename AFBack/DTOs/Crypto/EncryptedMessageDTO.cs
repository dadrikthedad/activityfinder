using AFBack.Common.DTOs;

namespace AFBack.DTOs.Crypto;

public class EncryptedAttachmentDto
{
    public string EncryptedFileUrl { get; set; } = string.Empty;
    public string FileType { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public long? FileSize { get; set; }
    public Dictionary<string, string> KeyInfo { get; set; } = new();
    public string IV { get; set; } = string.Empty;
    public int Version { get; set; } = 1;
    
    public string? EncryptedThumbnailUrl { get; set; } 
    public Dictionary<string, string>? ThumbnailKeyInfo { get; set; }
    public string? ThumbnailIV { get; set; }
    public int? ThumbnailWidth { get; set; }
    public int? ThumbnailHeight { get; set; }
}

public class SendEncryptedMessageRequestDTO
{
    public string? EncryptedText { get; set; } // Nullable for attachment-only
    public Dictionary<string, string> KeyInfo { get; set; } = new();
    public string IV { get; set; } = string.Empty;
    public int Version { get; set; } = 1;
    public List<EncryptedAttachmentDto>? EncryptedAttachments { get; set; }
    public int? ConversationId { get; set; }
    public string? ReceiverId { get; set; }
    public int? ParentMessageId { get; set; }
    public string? ParentMessagePreview { get; set; }
        
    // Validation helper
    public bool HasValidContent => 
        (!string.IsNullOrEmpty(EncryptedText) && KeyInfo.Any()) || 
        (EncryptedAttachments?.Any() == true);
}

public class EncryptedMessageResponseDTO
{
    public int Id { get; set; }
    public int? SenderId { get; set; }
    public string? EncryptedText { get; set; }
    public Dictionary<string, string> KeyInfo { get; set; } = new();
    public string IV { get; set; } = string.Empty;
    public int Version { get; set; }
    public string SentAt { get; set; } = string.Empty;
    public int ConversationId { get; set; }
    public List<EncryptedAttachmentDto> EncryptedAttachments { get; set; } = new();
    public int? ParentMessageId { get; set; }
    public string? ParentMessagePreview { get; set; }
    public bool IsSystemMessage { get; set; }
    public bool IsDeleted { get; set; }
    
    public List<ReactionDto> Reactions { get; set; } = new();
    public UserSummaryDto? ParentSender { get; set; }
    public UserSummaryDto? Sender { get; set; }
    public bool? IsRejectedRequest { get; set; }
    public bool? IsNowApproved { get; set; }
    public bool? IsSilent { get; set; }
}