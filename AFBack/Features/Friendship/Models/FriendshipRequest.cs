using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AFBack.Features.Auth.Models;
using AFBack.Features.Friendship.Enums;
namespace AFBack.Features.Friendship.Models;

/// <summary>
/// Representerer en vennskapsforespørsel fra én bruker til en annen.
/// Når forespørselen aksepteres, opprettes et Friendship-objekt for begge parter.
/// </summary>
public class FriendshipRequest
{
    // ======================== PRIMÆRNØKKEL ========================
    
    /// <summary>
    /// Unik identifikator for forespørselen
    /// </summary>
    [Key]
    public int Id { get; set; }
    
    // ======================== RELASJONER ========================

    /// <summary>
    /// ID til brukeren som sendte forespørselen
    /// </summary>
    [Required, MaxLength(100)]
    public string SenderId { get; set; } = null!;

    /// <summary>
    /// ID til brukeren som mottok forespørselen
    /// </summary>
    [Required, MaxLength(100)]
    public string ReceiverId { get; set; } = null!;
    
    // ======================== METADATA ========================
    
    /// <summary>
    /// Tidspunkt da forespørselen ble sendt
    /// </summary>
    public DateTime SentAt { get; set; } = DateTime.UtcNow;
    
    /// <summary>
    /// Nåværende status for forespørselen
    /// </summary>
    public FriendshipRequestStatus Status { get; set; } = FriendshipRequestStatus.Pending;
    
    // ======================== NAVIGASJONSEGENSKAPER ========================
    
    /// <summary>
    /// Brukeren som sendte forespørselen
    /// </summary>
    [ForeignKey(nameof(SenderId))]
    public AppUser Sender { get; set; } = null!;
    
    /// <summary>
    /// Brukeren som mottok forespørselen
    /// </summary>
    [ForeignKey(nameof(ReceiverId))]
    public AppUser Receiver { get; set; } = null!;
}
