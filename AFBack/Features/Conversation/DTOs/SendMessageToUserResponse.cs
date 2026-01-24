using AFBack.Features.Messaging.DTOs.Response;

namespace AFBack.Features.Conversation.DTOs;

/// <summary>
/// Response når man sender melding til en bruker
/// </summary>
public class SendMessageToUserResponse
{
    /// <summary>
    /// Samtale-ID (ny eller eksisterende)
    /// </summary>
    public int ConversationId { get; set; }
    
    /// <summary>
    /// True hvis dette er en nyopprettet samtale
    /// </summary>
    public bool IsNewConversation { get; set; }
    
    /// <summary>
    /// True hvis brukeren aksepterte en pending conversation ved å sende melding
    /// </summary>
    public bool WasAccepted { get; set; } 
    
    /// <summary>
    /// Samtaledetaljer
    /// </summary>
    public ConversationResponse Conversation { get; set; } = null!;
    
    /// <summary>
    /// Den sendte meldingen
    /// </summary>
    public MessageResponse Message { get; set; } = null!;
    
    
}
