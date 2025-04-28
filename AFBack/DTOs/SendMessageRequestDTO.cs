namespace AFBack.DTOs;
// Har har DTO-en til å sende en melding
public class SendMessageRequestDTO
{
    public string? ReceiverId { get; set; }
    public string? GroupName { get; set; }
    public string? Text { get; set; }
    public List<AttachmentDto>? Attachments { get; set; }
}

public class AttachmentDto
{
    public string FileUrl { get; set; } = null!;
    public string FileType { get; set; } = null!;
    public string? FileName { get; set; }
}