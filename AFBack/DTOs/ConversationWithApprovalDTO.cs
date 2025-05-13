using AFBack.Models;

namespace AFBack.DTOs;

public class ConversationWithApprovalDTO
{
    public Conversation Conversation { get; set; } = null!;
    public bool IsApproved { get; set; }
    public bool IsPendingApproval { get; set; }
}