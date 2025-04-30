namespace AFBack.DTOs;
// Har har DTO-en til å sende en melding
public class SendMessageRequestDTO
{
    public string? Text { get; set; }
    public List<AttachmentDto>? Attachments { get; set; }
    public int ConversationId { get; set; }
    public string? ReceiverId { get; set; } // Trengs kun for nye private samtaler slik at SendMessage kan opprette en samtale
    
    public int? ParentMessageId { get; set; }
}

public class AttachmentDto
{
    public string FileUrl { get; set; } = null!;
    public string FileType { get; set; } = null!;
    public string? FileName { get; set; }
}