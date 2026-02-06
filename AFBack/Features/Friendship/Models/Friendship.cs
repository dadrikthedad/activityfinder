using System.ComponentModel.DataAnnotations;
using AFBack.Features.Auth.Models;

namespace AFBack.Features.Friendship.Models;

/// <summary>
/// Representerer et vennskapsforhold mellom to brukere.
/// Dette er en direktional relasjon der begge parter har godkjent vennskapet.
/// </summary>
public class Friendship
{
    // ======================== PRIMÆRNØKLER ========================
    
    /// <summary>
    /// ID til brukeren som eier denne vennskapsrelasjonen
    /// </summary>
    [Required, MaxLength(100)]
    public string UserId { get; set; } = null!;
    
    /// <summary>
    /// ID til vennen i denne relasjonen
    /// </summary>
    [Required, MaxLength(100)]
    public string FriendId { get; set; } = null!;
    
    // ======================== METADATA ========================
    
    /// <summary>
    /// Tidspunkt da vennskapet ble opprettet (begge parter aksepterte)
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // ======================== SCORING SYSTEM ========================
    
    /// <summary>
    /// Poeng gitt av UserId til FriendId (brukes for rangering/prioritering)
    /// </summary>
    [Range(0, int.MaxValue)]
    public int UserToFriendScore { get; set; }

    /// <summary>
    /// Poeng gitt av FriendId til UserId (brukes for rangering/prioritering)
    /// </summary>
    [Range(0, int.MaxValue)]
    public int FriendToUserScore { get; set; }
    
    // ======================== NAVIGASJONSEGENSKAPER ========================
    
    /// <summary>
    /// Brukeren som eier denne vennskapsrelasjonen
    /// </summary>
    public AppUser User { get; set; } = null!;
    
    /// <summary>
    /// Vennen i denne relasjonen
    /// </summary>
    public AppUser Friend { get; set; } = null!;
}
