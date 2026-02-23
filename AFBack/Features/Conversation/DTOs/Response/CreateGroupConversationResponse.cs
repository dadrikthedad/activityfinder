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
    /// Feilmelding hvis gruppebilde-opplasting feilet. Null hvis bildet ble lastet opp OK eller ikke ble sendt med.
    /// </summary>
    public string? GroupImageUploadError { get; set; }
}
