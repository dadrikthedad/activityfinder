using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AFBack.Models.Auth;

namespace AFBack.Models;
// Her håndtere vi vennskaps-forespørseler mellom to brukere, brukes for å ta ansvar fra Friends.cs og for at man ikke er venner før faktisk godkjent
public enum InvitationStatus
{
    Pending,
    Accepted,
    Declined
}

public class FriendInvitation
{
    [Key]
    public int Id { get; set; }

    [ForeignKey("SenderId")]
    public AppUser Sender { get; set; } = null!;
    public int SenderId { get; set; }

    [ForeignKey("ReceiverId")]
    public AppUser Receiver { get; set; } = null!;
    public int ReceiverId { get; set; }

    public DateTime SentAt { get; set; } = DateTime.UtcNow;

    public InvitationStatus Status { get; set; } = InvitationStatus.Pending;
}
