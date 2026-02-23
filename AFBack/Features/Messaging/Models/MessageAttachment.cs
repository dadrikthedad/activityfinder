using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.Messaging.Models;

public class MessageAttachment
{
    // ======================== PRIMÆRNØKKEL ========================
    public int Id { get; set; }
    // ======================== Foreign Keys ========================
    public int MessageId { get; set; } // Endret fra MessageId
    
    // ======================== EncryptionData ========================
    [Required]
    [MaxLength(500)]
    public string EncryptedFileStorageKey { get; set; } = string.Empty;
        
    [Required]
    [MaxLength(100)]
    public string FileType { get; set; } = string.Empty;
        
    [Required]
    public string OriginalFileName { get; set; } = string.Empty; // Endret fra FileName
        
    public long OriginalFileSize { get; set; } // Endret fra FileSize
        

    [Required, MaxLength(2000)]
    public string KeyInfo { get; set; } = "{}"; // JSON string av encrypted keys
        
    [Required, MaxLength(100)]
    public string IV { get; set; } = string.Empty;
        
    public int Version { get; set; } = 1;
    
    // ======================== Thumbnail ========================
    [MaxLength(500)]
    public string? EncryptedThumbnailStorageKey { get; set; }
    
    [MaxLength(2000)]
    public string? ThumbnailKeyInfo { get; set; }
    [MaxLength(100)]
    public string? ThumbnailIV { get; set; }
    public int? ThumbnailWidth { get; set; }
    public int? ThumbnailHeight { get; set; }
    
    // ======================== MetaData ========================
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow; 
    
    // ======================== Navigasjonsegenskaper ========================
    public Message Message { get; set; } = null!;
}
