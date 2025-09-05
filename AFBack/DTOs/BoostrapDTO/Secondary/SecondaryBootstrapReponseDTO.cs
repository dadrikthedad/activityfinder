using AFBack.DTOs.Crypto;
using AFBack.Models;

namespace AFBack.DTOs
{
    public class SecondaryBootstrapResponseDTO
    {
        // Conversations og Messages flyttet hit fra Critical
        public List<ConversationDTO> RecentConversations { get; set; } = new();
        
        public Dictionary<int, List<EncryptedMessageResponseDTO>> ConversationMessages { get; set; } = new();
        
        // Existing secondary data
        public List<UserSummaryDTO> AllUserSummaries { get; set; } = new();
        public List<int> UnreadConversationIds { get; set; } = new();
        public List<MessageRequestDTO> PendingMessageRequests { get; set; } = new();
        public List<MessageNotificationDTO> RecentMessageNotifications { get; set; } = new();
        public List<FriendInvitationDTO> PendingFriendInvitations { get; set; } = new();
        public List<NotificationDTO> RecentNotifications { get; set; } = new();
    }
}