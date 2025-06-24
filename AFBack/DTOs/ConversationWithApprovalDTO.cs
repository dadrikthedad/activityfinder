using AFBack.Models;

namespace AFBack.DTOs;

public class ConversationWithApprovalDTO
{
    public Conversation Conversation { get; set; } = null!;
    public bool IsPendingApproval { get; set; }
    
    public Dictionary<int, GroupRequestStatus> GroupRequestLookup { get; set; } = new();
}