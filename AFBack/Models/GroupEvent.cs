using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;

namespace AFBack.Models;

public class GroupEvent
{
    public int Id { get; set; }
    
    [Required]
    public int ConversationId { get; set; }
    public Conversation Conversation { get; set; } = null!;
    
    [Required]
    public GroupEventType EventType { get; set; }
    
    [Required]
    public int ActorUserId { get; set; }
    public User ActorUser { get; set; } = null!;
    
    // JSON-serialisert liste med bruker-IDs for EF Core
    [Required]
    [MaxLength(2000)]
    public string AffectedUserIdsJson { get; set; } = "[]";
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    [MaxLength(4000)]
    public string? Metadata { get; set; }
    
    // Computed property - ikke lagret i database
    [NotMapped]
    public List<int> AffectedUserIds
    {
        get => string.IsNullOrEmpty(AffectedUserIdsJson) 
            ? new List<int>() 
            : JsonSerializer.Deserialize<List<int>>(AffectedUserIdsJson) ?? new List<int>();
        set => AffectedUserIdsJson = JsonSerializer.Serialize(value);
    }
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