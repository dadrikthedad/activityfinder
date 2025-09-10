using System.ComponentModel.DataAnnotations;

namespace AFBack.DTOs.Crypto.EncryptedMessageAttachments;

public class UploadEncryptedJSONRequestDTO
{
    [Required]
    public List<EncryptedFileDataDto> EncryptedFilesData { get; set; } = new();
    
    public string? Text { get; set; }
    public string? TextKeyInfo { get; set; }
    public string? TextIV { get; set; }
    
    [Required]
    [Range(1, int.MaxValue)]
    public int ConversationId { get; set; }
    
    public int? ReceiverId { get; set; }
    public int? ParentMessageId { get; set; }
}

public class EncryptedFileDataDto
{
    [Required]
    [StringLength(255)]
    public string FileName { get; set; } = string.Empty;
    
    [Required]
    [StringLength(100)]
    public string FileType { get; set; } = string.Empty;
    
    [Range(1, long.MaxValue)]
    public long FileSize { get; set; }
    
    [Required]
    public Dictionary<string, string> KeyInfo { get; set; } = new();
    
    [Required]
    public string IV { get; set; } = string.Empty;
    
    [Range(1, int.MaxValue)]
    public int Version { get; set; } = 1;
    
    [Required]
    [MaxLength(150 * 1024 * 1024)]
    public string EncryptedFileData { get; set; } = string.Empty; // Base64 av kryptert fil
    
    public Dictionary<string, string>? ThumbnailKeyInfo { get; set; }
    public string? ThumbnailIV { get; set; }
    public int? ThumbnailWidth { get; set; }
    public int? ThumbnailHeight { get; set; }
    [MaxLength(10 * 1024 * 1024)] // Max 10MB thumbnail
    public string? EncryptedThumbnailData { get; set; }
}