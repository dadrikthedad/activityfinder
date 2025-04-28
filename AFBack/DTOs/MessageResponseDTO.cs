namespace AFBack.DTOs;

public class MessageResponseDTO
{
    public int Id { get; set; }
    public string SenderId { get; set; } = null!;
    public string? ReceiverId { get; set; }
    public string? GroupName { get; set; }
    public string? Text { get; set; }
    public DateTime SentAt { get; set; }
    public List<AttachmentDto> Attachments { get; set; } = new();
}