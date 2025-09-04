using AFBack.DTOs.Crypto;

namespace AFBack.DTOs.BoostrapDTO;

public class CriticalBootstrapResponseDTO
{
    public UserSummaryDTO User { get; set; } = null!;
    public string SyncToken { get; set; } = string.Empty;
    public Dictionary<int, List<EncryptedMessageResponseDTO>>? ConversationMessages { get; set; }
    public List<ConversationDTO> RecentConversations { get; set; } = new();
}