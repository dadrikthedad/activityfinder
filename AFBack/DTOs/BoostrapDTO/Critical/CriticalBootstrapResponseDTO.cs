namespace AFBack.DTOs.BoostrapDTO;

public class CriticalBootstrapResponseDTO
{
    public UserSummaryDTO User { get; set; } = null!;
    public string SyncToken { get; set; } = string.Empty;
    public Dictionary<int, List<MessageResponseDTO>>? ConversationMessages { get; set; }
    public List<ConversationDTO> RecentConversations { get; set; } = new();
}