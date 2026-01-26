using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.Conversation.DTOs.Request;

/// <summary>
/// Request for å sende en melding til en bruker. Oppretter ny samtale hvis ingen finnes.
/// Støtter kun tekst
/// </summary>
public class SendMessageToUserRequest
{
    /// <summary>
    /// Brukeren som skal motta meldingen
    /// </summary>
    [Required(ErrorMessage = "ReceiverId is required")]
    [MinLength(1, ErrorMessage = "ReceiverId cannot be empty")]
    public string ReceiverId { get; set; } = null!;
    
    // ======================== KrypteringsInfo ========================
    
    /// <summary>
    /// Kryptert meldingstekst
    /// </summary>
    [Required(ErrorMessage = "EncryptedText is required")]
    [MinLength(1, ErrorMessage = "Message cannot be empty")]
    [MaxLength(10000, ErrorMessage = "Message is too long")]
    public string EncryptedText { get; set; } = null!;
    
    /// <summary>
    /// Krypteringsnøkler per mottaker
    /// </summary>
    [Required(ErrorMessage = "KeyInfo is required")]
    [MinLength(1, ErrorMessage = "KeyInfo must contain at least one key")]
    public Dictionary<string, string> KeyInfo { get; set; } = new();
    
    /// <summary>
    /// Initialization Vector for kryptering
    /// </summary>
    [Required(ErrorMessage = "IV is required")]
    [MinLength(1, ErrorMessage = "IV cannot be empty")]
    public string IV { get; set; } = null!;
    
    /// <summary>
    /// Krypteringsversjon
    /// </summary>
    public int Version { get; set; } = 1;
}
