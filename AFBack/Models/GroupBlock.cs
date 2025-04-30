namespace AFBack.Models;

public class GroupBlock
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int ConversationId { get; set; }
    public DateTime BlockedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public Conversation Conversation { get; set; } = null!;
}