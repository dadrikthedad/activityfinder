namespace AFBack.Features.SendMessage.DTOs;


public class SendMessageResponse
{
    public int MessageId { get; set; }
    
    public DateTime SentAt { get; set; }
    
    public int ConversationId { get; set; } // TODO: Fjernes
    
    public SendMessageAttachmentResponse[]? Attachments { get; set; }
}
