using AFBack.Features.Conversation.DTOs;

namespace AFBack.DTOs;

public class PagedConversationsResponseDTO
{
    public int TotalCount { get; set; } // Totalt antall samtaler (for paginering)
    public List<ConversationDto> Conversations { get; set; } = new();
}