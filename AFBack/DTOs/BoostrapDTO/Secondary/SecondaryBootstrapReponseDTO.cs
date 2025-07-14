namespace AFBack.DTOs
{
    public class SecondaryBootstrapResponseDTO
    {
        public UserSettingsDTO Settings { get; set; } = null!;
        public List<UserSummaryDTO> Friends { get; set; } = new();
        public List<UserSummaryDTO> BlockedUsers { get; set; } = new();
    }
}