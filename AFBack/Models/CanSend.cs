using Microsoft.EntityFrameworkCore;

namespace AFBack.Models;

public class CanSend
{
    public int Id { get; set; }

    public int ConversationId { get; set; }
    public Conversation Conversation { get; set; } = null!;

    public int UserId { get; set; } // Brukeren som er "godkjent"
    public User User { get; set; } = null!;

    public DateTime ApprovedAt { get; set; } = DateTime.UtcNow;
    
    public CanSendReason Reason { get; set; } = CanSendReason.MessageRequest;
    
    public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
}

public enum CanSendReason
{
    MessageRequest = 0,  // Godkjent via meldingsforespørsel
    GroupRequest = 1,    // Godkjent via gruppeforespørsel 
    Friendship = 3       // Automatisk godkjent pga vennskap
}
