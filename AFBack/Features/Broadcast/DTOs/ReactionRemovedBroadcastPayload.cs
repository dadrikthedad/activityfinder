namespace AFBack.Features.Broadcast.DTOs;

public class ReactionRemovedBroadcastPayload
{
    public int ConversationId { get; set; }
    public int MessageId { get; set; }
    public string UserId { get; set; } = string.Empty;
}
