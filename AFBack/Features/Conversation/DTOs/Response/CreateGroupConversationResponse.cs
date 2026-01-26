namespace AFBack.Features.Conversation.DTOs.Response;

public class CreateGroupConversationResponse
{
    /// <summary>
    /// Samtale-ID (ny)
    /// </summary>
    public int ConversationId { get; set; }
    
    /// <summary>
    /// Samtaledetaljer
    /// </summary>
    public ConversationResponse Conversation { get; set; } = null!;
    
    /// <summary>
    /// Liste over bruker-IDer som ikke kunne inviteres pga blokkeringer.
    /// Frontend bruker dette til å vise røde ringer rundt disse brukerne.
    /// </summary>
    public List<string> BlockedUserIds { get; set; } = new();
}
