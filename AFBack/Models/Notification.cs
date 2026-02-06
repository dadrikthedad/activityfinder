using System.ComponentModel.DataAnnotations;
using AFBack.DTOs;
using AFBack.Features.Auth.Models;

namespace AFBack.Models;
// Notification til en bruker
public class Notification
{
    // Id-en på notifikasjonen
    public int Id { get; set; }
    
    // Typen av forespørsel
    [Required]
    public NotificationEntityType Type { get; set; } // F.eks. "FriendRequest", "Message"
    
    // Meldingen, feks hvis det er en melding sendt mellom brukere
    public string? Message { get; set; } // Frivillig meldingstekst
    
    // La notification forsvinne fra UI-en ved at bruker har lest
    public bool IsRead { get; set; } = false;
    
    // Når ble notification laget
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // 🔹 Mottaker av notifikasjonen
    public int RecipientUserId { get; set; }
    public AppUser RecipientUser { get; set; } = null!;

    // 🔸 Brukeren som relaterer til denne notif. (f.eks. den som sendte venneforespørsel)
    public int? RelatedUserId { get; set; }
    public AppUser? RelatedUser { get; set; } = null!;
    
    public int? PostId { get; set; }
    public int? CommentId { get; set; }
    public int? FriendInvitationId { get; set; }
    public int? EventInvitationId { get; set; }
    // Brukes når vi aksepterer en venneforespørsel og det er en gyldig messagerequest der
    public int? ConversationId { get; set; }
    
}

public enum NotificationEntityType
{
    None,
    Post,
    Comment,
    FriendInvitation,
    FriendInvAccepted,
    EventInvitation
}
