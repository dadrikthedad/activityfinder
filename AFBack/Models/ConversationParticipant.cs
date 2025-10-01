namespace AFBack.Models;

public class ConversationParticipant
{
    public int Id { get; set; }

    public int ConversationId { get; set; }
    public Conversation Conversation { get; set; } = null!;

    public int UserId { get; set; } // Antar at User har string som Id
    public User User { get; set; } = null!;

    public bool HasDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    
    public ConversationStatus? ConversationStatus { get; set; }
}

public enum ConversationStatus 
{ 
    Pending = 0,
    Approved = 1, 
    Rejected = 2,
    Creator = 3
}
