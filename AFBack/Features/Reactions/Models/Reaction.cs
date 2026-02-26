using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AFBack.Features.Auth.Models;
using AFBack.Features.Messaging.Models;

namespace AFBack.Features.Reactions.Models;

/// <summary>
/// Representerer en reaksjon (emoji) på en melding.
/// Hver bruker kan reagere med én emoji per melding.
/// </summary>
public class Reaction
{
    // ======================== PRIMÆRNØKKEL ========================
    
    /// <summary>
    /// Unik identifikator for reaksjonen
    /// </summary>
    [Key]
    public int Id { get; set; }

    // ======================== FREMMEDNØKLER ========================
    
    /// <summary>
    /// ID til meldingen denne reaksjonen tilhører
    /// </summary>
    [Required]
    public int MessageId { get; set; }
    
    /// <summary>
    /// ID til brukeren som reagerte
    /// </summary>
    [Required, MaxLength(100)]
    public string UserId { get; set; } = null!;

    // ======================== DATA ========================
    
    /// <summary>
    /// Emoji-tegnet som ble brukt som reaksjon
    /// </summary>
    [Required, MaxLength(20)]
    public string Emoji { get; set; } = string.Empty;

    // ======================== METADATA ========================
    
    /// <summary>
    /// Tidspunkt da reaksjonen ble opprettet
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // ======================== NAVIGASJONSEGENSKAPER ========================
    
    /// <summary>
    /// Meldingen denne reaksjonen tilhører
    /// </summary>
    [ForeignKey("MessageId")]
    public Message Message { get; set; } = null!;
    
    /// <summary>
    /// Brukeren som reagerte
    /// </summary>
    [ForeignKey("UserId")]
    public AppUser User { get; set; } = null!;
}
