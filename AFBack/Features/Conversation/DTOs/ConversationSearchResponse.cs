using AFBack.DTOs;

namespace AFBack.Features.Conversation.DTOs;

public class ConversationSearchResponse
{
    public List<ConversationDto> Conversations { get; set; } = [];
    
    //Paginering
    public int TotalCount { get; set; }
    public int PageSize { get; set; }
    public int CurrentPage { get; set; }
    public bool HasMore { get; set; }
}
