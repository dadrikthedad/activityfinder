namespace AFBack.Features.Conversation.DTOs.Response;

public class ConversationLeftRecordResponse
{
    public int ConversationId { get; set; }
    public string? GroupName { get; set; }
    public string? GroupImageUrl { get; set; }
    public DateTime LeftAt { get; set; }
}
