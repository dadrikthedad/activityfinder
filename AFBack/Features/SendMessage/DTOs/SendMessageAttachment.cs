using System.ComponentModel.DataAnnotations;
using System.Diagnostics.CodeAnalysis;

namespace AFBack.Features.SendMessage.DTOs;

public class SendMessageAttachment
{
    [Required(ErrorMessage = "FileName is required")]
    [StringLength(255, ErrorMessage = "FileName has too many characters. Max 255")]
    public string FileName { get; set; } = string.Empty;
    
    [Required(ErrorMessage = "FileType is required")]
    [StringLength(100, ErrorMessage = "FileType has too many characters. Max 100")]
    public string FileType { get; set; } = string.Empty;
    
    [Required(ErrorMessage = "FileSize is required")]
    [Range(1, long.MaxValue, ErrorMessage = "FileSize must be greater than 0")]
    public long FileSize { get; set; }
    
    [Required(ErrorMessage = "KeyInfo is required")]
    public Dictionary<string, string> KeyInfo { get; set; } = new();
    
    [Required(ErrorMessage = "IV is required")]
    [SuppressMessage("ReSharper", "InconsistentNaming")]
    public string IV { get; set; } = string.Empty;
    
    [Range(1, int.MaxValue, ErrorMessage = "Version must be between 0 and maxValue")]
    public int Version { get; set; } = 1;
    
    // Base64 dataen relatert til den krypterte filen
    [Required(ErrorMessage = "EncryptedFileData is required")]
    public string EncryptedFileData { get; set; } = string.Empty;

    [Required(ErrorMessage = "ThumbnailKeyInfo is required")]
    public Dictionary<string, string> ThumbnailKeyInfo { get; set; } = new();

    [Required(ErrorMessage = "ThumbnailIV is required")]
    [SuppressMessage("ReSharper", "InconsistentNaming")]
    public string ThumbnailIV { get; set; } = string.Empty;
    
    public int? ThumbnailWidth { get; set; }
    public int? ThumbnailHeight { get; set; }
    
    // Base64 dataen relatert til den krypterte thumbnailen
    [Required(ErrorMessage = "EncryptedThumbnailData is required")]
    public string EncryptedThumbnailData { get; set; } = string.Empty; 
    
    // Optimistisk ID tror jeg må være med for å kunne mappe det riktig i frontend TODO: Sjekke at den må være med ifrontend
    public string? OptimisticId { get; set; }
}
