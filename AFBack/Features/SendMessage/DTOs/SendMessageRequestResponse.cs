namespace AFBack.Features.SendMessage.DTOs;

public class SendMessageRequestResponse
{
    public int ConversationId { get; set; }
    public int RequestReceiverId { get; set; }
    public int MessageRequestId { get; set; }
}