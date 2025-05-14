namespace AFBack.DTOs;

public class MessageRequestCreatedDto
{
    public int SenderId { get; set; }
    public int ReceiverId { get; set; }
    public int ConversationId { get; set; }
}