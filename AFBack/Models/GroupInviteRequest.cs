namespace AFBack.Models;

public class GroupInviteRequest
{
    public int Id { get; set; }

    public int ConversationId { get; set; }   // 👈 Denne mangler hos deg
    public int InviterId { get; set; }
    public int InvitedUserId { get; set; }

    public bool IsAccepted { get; set; } = false;
    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;

    // Navigasjonsfelt (valgfritt men anbefalt)
    public User Inviter { get; set; } = null!;
    public User InvitedUser { get; set; } = null!;
    public Conversation Conversation { get; set; } = null!;
}
