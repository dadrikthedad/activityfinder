using AFBack.DTOs.Crypto;

namespace AFBack.DTOs.BoostrapDTO;

public class CriticalBootstrapResponseDTO
{
    public UserSummaryDTO User { get; set; } = null!;
    public UserSettingsDTO Settings { get; set; } = null!;
    public string SyncToken { get; set; } = string.Empty;
}