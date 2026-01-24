using System.ComponentModel.DataAnnotations;
using AFBack.Models.Auth;

namespace AFBack.Models;

public class GroupEvent
{
    public int Id { get; set; }

    [Required] public int ConversationId { get; set; }
    public Features.Conversation.Models.Conversation Conversation { get; set; } = null!;

    [Required] public GroupEventType EventType { get; set; }

    [Required] public int ActorUserId { get; set; }
    public AppUser ActorUser { get; set; } = null!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [MaxLength(4000)] public string? Metadata { get; set; }

    // Navigation property til affected users
    public ICollection<GroupEventAffectedUser> AffectedUsers { get; set; } = new List<GroupEventAffectedUser>();
}

public enum GroupEventType
{
    MemberInvited = 1,      // Brukere invitert til gruppen
    MemberAccepted = 2,     // Bruker godkjente invitasjon
    MemberLeft = 3,         // Bruker forlot gruppen
    MemberRemoved = 4,      // Bruker ble fjernet fra gruppen
    GroupCreated = 5,       // Gruppe opprettet
    GroupNameChanged = 6,   // Gruppenavn endret
    GroupImageChanged = 7   // Gruppebilde endret
}
