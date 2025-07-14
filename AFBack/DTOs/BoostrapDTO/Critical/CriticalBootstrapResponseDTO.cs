namespace AFBack.DTOs.BoostrapDTO;

public class CriticalBootstrapResponseDTO
{
    public UserSummaryDTO User { get; set; } = null!;
    public string SyncToken { get; set; } = string.Empty;
    public List<ConversationDTO> RecentConversations { get; set; } = new();
}