namespace AFBack.Features.Messaging.DTOs;

/// <summary>
/// Intern DTO for attachment-data fra databasen. Brukes som mellomformat mellom Repository og Service-lag.
/// Forskjellig fra SendMessageAttachmentREsponse
/// </summary>
public class AttachmentDto
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
