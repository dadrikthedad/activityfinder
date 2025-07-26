using AFBack.Models;

namespace AFBack.DTOs
{
    public class SecondaryBootstrapResponseDTO
    {
        public UserSettingsDTO Settings { get; set; } = null!;
        public List<UserSummaryDTO> Friends { get; set; } = new();
        public List<UserSummaryDTO> BlockedUsers { get; set; } = new();
        // Uleste samtaler for at frontend ser hvem samtaler som har notifikasjoner
        public List<int> UnreadConversationIds { get; set; } = new();
        public List<MessageRequestDTO> PendingMessageRequests { get; set; } = new();
        
        public List<MessageNotificationDTO> RecentMessageNotifications { get; set; } 
        public List<FriendInvitationDTO> PendingFriendInvitations { get; set; }
        
        public List<NotificationDTO> RecentNotifications { get; set; } 
        
    }
}