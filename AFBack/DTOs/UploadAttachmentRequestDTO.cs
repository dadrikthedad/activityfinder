namespace AFBack.DTOs;

public class UploadAttachmentsRequestDTO
{
    public string? Text { get; set; }
    public List<IFormFile> Files { get; set; } = new();
    public int ConversationId { get; set; }
    public string? ReceiverId { get; set; }
    public int? ParentMessageId { get; set; }
}