namespace AFBack.Features.Messaging.DTOs.Response;

/// <summary>
/// Response på SendMessage - rask og enkel DTO for å ikke returnere alle felt til frontend
/// </summary>
public class SendMessageResponse
{
    public int MessageId { get; set; }
    
    public DateTime SentAt { get; set; }
    
    public SendMessageAttachmentResponse[]? Attachments { get; set; }
}
