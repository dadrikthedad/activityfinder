using System.ComponentModel.DataAnnotations;

namespace AFBack.Models.Crypto;

public class EncryptedAttachment
{
    public int Id { get; set; }
    public int MessageId { get; set; }
    public EncryptedMessage Message { get; set; }
        
    [Required]
    public string EncryptedFileUrl { get; set; } = string.Empty;
        
    [Required]
    public string FileType { get; set; } = string.Empty;
        
    [Required]
    public string FileName { get; set; } = string.Empty;
        
    public long FileSize { get; set; }
        
    [Required]
    public string KeyInfo { get; set; } = "{}"; // JSON string of encrypted keys
        
    [Required]
    public string IV { get; set; } = string.Empty;
        
    public int Version { get; set; } = 1;
}