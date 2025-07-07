using System.ComponentModel.DataAnnotations;

namespace AFBack.Models;

public class Conversation
{
    public int Id { get; set; }
    public bool IsGroup { get; set; }
    
    [MaxLength(100)]
    public string? GroupName { get; set; }
    
    [MaxLength(512)]
    public string? GroupImageUrl { get; set; }
    
    public int CreatorId { get; set; } // Hvem som opprettet samtalen

    public bool IsApproved { get; set; } // Er samtalen godkjent (for én-til-én)
    
    public DateTime? LastMessageSentAt { get; set; } // For å gjøre det lett å sortere

    public bool HasUnreadMessages { get; set; } // For å se om vi har uleste meldinger her
    
    
    public bool IsDisbanded { get; set; } = false;
    
    public DateTime? DisbandedAt { get; set; }
    
    public ICollection<CanSend> ApprovedSenders { get; set; } = new List<CanSend>();
    public ICollection<ConversationParticipant> Participants { get; set; } = new List<ConversationParticipant>();
    public ICollection<Message> Messages { get; set; } = new List<Message>();
}