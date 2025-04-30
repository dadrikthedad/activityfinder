namespace AFBack.DTOs;

public class PagedConversationsResponseDTO
{
    public int TotalCount { get; set; } // Totalt antall samtaler (for paginering)
    public List<ConversationDTO> Conversations { get; set; } = new();
}