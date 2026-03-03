using AFBack.Common.DTOs;
using AFBack.Features.Conversation.Enums;

namespace AFBack.Features.Conversation.DTOs.Response;

public class ParticipantResponse
{
    // ====================== Hver bruker sin Id, Navn og Profilbilde ======================
    public UserSummaryDto User { get; set; } = null!;
    
    // ====================== Samtalerelevante egenskaper ======================
    public ConversationStatus Status { get; set; }
    public ParticipantRole Role { get; set; }
    public int? PendingMessagesReceived { get; set; } = 0;
    
    // Grupperelatert
    public DateTime? InvitedAt { get; set; } = DateTime.UtcNow;
    public DateTime? JoinedAt { get; set; } = DateTime.UtcNow; 
    
}
