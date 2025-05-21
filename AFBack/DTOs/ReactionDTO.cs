namespace AFBack.DTOs;

public class ReactionDTO
{
    public int MessageId { get; set; }
    public string Emoji { get; set; } = string.Empty;
    public int UserId { get; set; }
    
    public int ConversationId { get; set; }
    
    public string? UserFullName { get; set; } 
    public bool IsRemoved { get; set; }
}