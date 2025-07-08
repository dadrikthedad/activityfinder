namespace AFBack.Models;

public class ConversationParticipant
{
    public int Id { get; set; }

    public int ConversationId { get; set; }
    public Conversation Conversation { get; set; } = null!;

    public int UserId { get; set; } // Antar at User har string som Id
    public User User { get; set; } = null!;
    
    public bool HasDeleted { get; set; } = false;
    public DateTime? DeletedAt { get; set; }
}
