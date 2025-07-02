namespace AFBack.DTOs;

// Sendes til frontend til slutt
public class SendGroupRequestsResponseDTO
{
    public int ConversationId { get; set; }
    public bool IsNewConversation { get; set; }
    public int InvitationsSent { get; set; }
    public int TotalRequestedUsers { get; set; }
}
