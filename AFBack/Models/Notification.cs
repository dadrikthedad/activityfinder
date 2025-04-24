using System.ComponentModel.DataAnnotations;
using AFBack.DTOs;

namespace AFBack.Models;
// Notification til en bruker
public class Notification
{
    // Id-en på notifikasjonen
    public int Id { get; set; }
    
    // Typen av forespørsel
    [Required]
    public string Type { get; set; } = null!; // F.eks. "FriendRequest", "Message"
    
    // Meldingen, feks hvis det er en melding sendt mellom brukere
    public string? Message { get; set; } // Frivillig meldingstekst
    
    // La notification forsvinne fra UI-en ved at bruker har lest
    public bool IsRead { get; set; } = false;
    
    // Når ble notification laget
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // 🔹 Mottaker av notifikasjonen
    public int RecipientUserId { get; set; }
    public User RecipientUser { get; set; } = null!;

    // 🔸 Brukeren som relaterer til denne notif. (f.eks. den som sendte venneforespørsel)
    public int? RelatedUserId { get; set; }
    public User? RelatedUser { get; set; } = null!;

    
}