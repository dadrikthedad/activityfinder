namespace AFBack.Models;

public class Conversation
{
    public int Id { get; set; }
    public bool IsGroup { get; set; }
    public string? GroupName { get; set; }
    public ICollection<ConversationParticipant> Participants { get; set; } = new List<ConversationParticipant>();
    public ICollection<Message> Messages { get; set; } = new List<Message>();

}