namespace AFBack.Features.Conversation.DTOs.Response;

public class ConversationsResponse
{
    public List<ConversationResponse> Conversations { get; set; } = [];
    
    //Paginering
    public int TotalCount { get; set; }
    public int PageSize { get; set; }
    public int CurrentPage { get; set; }
    public bool HasMore { get; set; }
}
