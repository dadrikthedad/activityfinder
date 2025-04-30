namespace AFBack.DTOs;

public class GroupInviteRequestDTO
{
    public int ConversationId { get; set; }
    public string GroupName { get; set; } = string.Empty;

    public int InviterId { get; set; }
    public string InviterName { get; set; } = string.Empty;
        
    public string? InviterProfileImageUrl { get; set; }

    public DateTime RequestedAt { get; set; }
}