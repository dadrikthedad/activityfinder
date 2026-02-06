using AFBack.Features.Auth.Models;

namespace AFBack.Models;

public class ConversationReadState
{
    public int Id { get; set; }

    public int UserId { get; set; }
    public AppUser User { get; set; } = null!;

    public int ConversationId { get; set; }
    public Features.Conversation.Models.Conversation Conversation { get; set; } = null!;

    public DateTime LastReadAt { get; set; }
}
