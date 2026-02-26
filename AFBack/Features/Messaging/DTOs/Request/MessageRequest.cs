using System.ComponentModel.DataAnnotations;
using System.Diagnostics.CodeAnalysis;

namespace AFBack.Features.Messaging.DTOs.Request;

/// <summary>
/// Bruker sender en melding - SendMessage
/// </summary>
public class MessageRequest : IValidatableObject 
{
    // ======================== Metadata ========================
    
    [Required(ErrorMessage = "ConversationId is required")]
    [Range(1, int.MaxValue, ErrorMessage = "ConversationId must be greater than 0")]
    public int ConversationId { get; set; }
    // ReSharper disable once CollectionNeverUpdated.Global
    public List<AttachmentRequest>? EncryptedAttachments { get; set; }
    
    
    // ======================== KrypteringsInfo ========================

    public string OptimisticId { get; set; } = string.Empty;
    
    public string? EncryptedText { get; set; } // Nullable for attachment-only
    
    [Required(ErrorMessage = "KeyInfo is required.")]
    public Dictionary<string, string> KeyInfo { get; set; } = new();
    
    
    [Required(ErrorMessage = "IV is required.")]
    [MinLength(1, ErrorMessage = "IV cannot be empty")]
    [SuppressMessage("ReSharper", "InconsistentNaming")]
    public required string IV { get; set; }
    
    public int Version { get; set; } = 1;
    
    
    // ======================== Parent Message ========================
    public int? ParentMessageId { get; set; }
    
    public string? ParentMessagePreview { get; set; }
    
    // ======================== Metode ========================
    
    public int NumberOfAttachments => EncryptedAttachments?.Count ?? 0;
    
    // ======================== Validation ========================
    /// <summary>
    /// Validerer at det ikke er en tom melding, enten med tekst eller attachments vedlagt.
    /// Sjekker maks attachments
    /// </summary>
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {   
        // Sjekker om det er tekst
        var hasText = !string.IsNullOrEmpty(EncryptedText) 
                      && KeyInfo.Count > 0 
                      && !string.IsNullOrEmpty(IV);
        
        // Sjekker om det er attachments
        var hasAttachments = NumberOfAttachments > 0;
        
        // Sjekk om det er tekst eller attachmetns med
        if (!hasText && !hasAttachments)
            yield return new ValidationResult(
                "The message must contain either text or attachments",
                [nameof(EncryptedText), nameof(EncryptedAttachments)]);
        
        // Sjekker maks attachments sendt
        if (NumberOfAttachments > 10)
            yield return new ValidationResult("Maximum 10 attachments allowed",
                [nameof(EncryptedAttachments)]);

    }
    
}

