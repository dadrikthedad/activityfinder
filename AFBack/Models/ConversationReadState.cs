namespace AFBack.Models;

public class ConversationReadState
{
    public int Id { get; set; }

    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public int ConversationId { get; set; }
    public Conversation Conversation { get; set; } = null!;

    public DateTime LastReadAt { get; set; }
}