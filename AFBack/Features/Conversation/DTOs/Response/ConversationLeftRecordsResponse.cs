namespace AFBack.Features.Conversation.DTOs.Response;

public class ConversationLeftRecordsResponse
{
    public List<ConversationLeftRecordResponse> Records { get; set; } = [];
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public bool HasMore => Page * PageSize < TotalCount;
}
