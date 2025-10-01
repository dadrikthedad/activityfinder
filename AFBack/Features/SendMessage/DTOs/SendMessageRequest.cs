using System.ComponentModel.DataAnnotations;
using System.Diagnostics.CodeAnalysis;

namespace AFBack.Features.SendMessage.DTOs;

public class SendMessageRequest
{
    public string? EncryptedText { get; set; } // Nullable for attachment-only
    
    [Required(ErrorMessage = "KeyInfo is required.")]
    public Dictionary<string, string> KeyInfo { get; set; } = new();
    
    
    [Required(ErrorMessage = "IV is required.")]
    [MinLength(1, ErrorMessage = "IV cannot be empty")]
    [SuppressMessage("ReSharper", "InconsistentNaming")]
    public required string IV { get; set; }
    
    public int Version { get; set; } = 1;
    
    // ReSharper disable once CollectionNeverUpdated.Global
    public List<SendMessageAttachment>? EncryptedAttachments { get; set; }
    
    [Required(ErrorMessage = "ConversationId is required")]
    [Range(1, int.MaxValue, ErrorMessage = "ConversationId must be greater than 0")]
    public int ConversationId { get; set; }
    
    public int? ParentMessageId { get; set; }
    
    public string? ParentMessagePreview { get; set; }
    
    public int NumberOfAttachments => EncryptedAttachments?.Count ?? 0;
    
    // Validation helper
    public bool HasValidContent => 
        ConversationId > 0 &&
        ((!string.IsNullOrEmpty(EncryptedText) && KeyInfo.Count > 0 && !string.IsNullOrEmpty(IV)) || 
         NumberOfAttachments > 0);
    
}

