using System.ComponentModel.DataAnnotations;

namespace AFBack.Models.Crypto;

public class EncryptedAttachment
{
    public int Id { get; set; }
    public int EncryptedMessageId { get; set; } // Endret fra MessageId
    public EncryptedMessage Message { get; set; }
        
    [Required]
    public string EncryptedFileUrl { get; set; } = string.Empty;
        
    [Required]
    public string FileType { get; set; } = string.Empty;
        
    [Required]
    public string OriginalFileName { get; set; } = string.Empty; // Endret fra FileName
        
    public long OriginalFileSize { get; set; } // Endret fra FileSize
        
    [Required]
    public string KeyInfo { get; set; } = "{}"; // JSON string av encrypted keys
        
    [Required]
    public string IV { get; set; } = string.Empty;
        
    public int Version { get; set; } = 1;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow; // Legg til
    
    public string? EncryptedThumbnailUrl  { get; set; }
    public string? ThumbnailKeyInfo { get; set; }
    public string? ThumbnailIV { get; set; }
    public int? ThumbnailWidth { get; set; }
    public int? ThumbnailHeight { get; set; }
}