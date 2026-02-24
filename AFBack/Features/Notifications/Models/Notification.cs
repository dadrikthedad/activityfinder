using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AFBack.Features.Auth.Models;
using AFBack.Features.Notifications.Enums;

namespace AFBack.Features.Notifications.Models;


/// <summary>
/// Representerer en notifikasjon til en bruker.
/// Brukes for å varsle om hendelser som venneforespørsler, aksepterte forespørsler osv.
/// </summary>
public class Notification
{
    // ======================== PRIMÆRNØKKEL ========================
    
    /// <summary>
    /// Unik identifikator for notifikasjonen
    /// </summary>
    [Key]
    public int Id { get; set; }
    
    // ======================== RELASJONER ========================
    
    /// <summary>
    /// ID til brukeren som mottar notifikasjonen
    /// </summary>
    [Required, MaxLength(100)]
    public string RecipientUserId { get; set; } = null!;
    
    /// <summary>
    /// ID til brukeren som utløste notifikasjonen (f.eks. den som sendte venneforespørsel)
    /// </summary>
    [MaxLength(100)]
    public string? RelatedUserId { get; set; }
    
    // ======================== METADATA ========================
    
    /// <summary>
    /// Type notifikasjon
    /// </summary>
    [Required]
    public NotificationEventType Type { get; set; }

    /// <summary>
    ///
    /// Notification teksten (f.eks. "Ola har sendt deg en venneforespørsel")
    /// </summary>
    [MaxLength(500)]
    public string Summary { get; set; } = string.Empty;
    
    /// <summary>
    /// Om brukeren har lest notifikasjonen
    /// </summary>
    public bool IsRead { get; set; }
    
    /// <summary>
    /// Tidspunkt da notifikasjonen ble opprettet
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // ======================== NAVIGASJONSEGENSKAPER ========================
    
    /// <summary>
    /// Brukeren som mottar notifikasjonen
    /// </summary>
    [ForeignKey(nameof(RecipientUserId))]
    public AppUser RecipientUser { get; set; } = null!;
    
    /// <summary>
    /// Brukeren som utløste notifikasjonen
    /// </summary>
    [ForeignKey(nameof(RelatedUserId))]
    public AppUser? RelatedUser { get; set; }
}


