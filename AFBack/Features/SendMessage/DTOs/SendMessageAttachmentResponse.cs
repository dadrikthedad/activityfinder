namespace AFBack.Features.SendMessage.DTOs;

public class SendMessageAttachmentResponse
{
    public int Id { get; set; }
    public string? OptimisticId { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public string ThumbnailUrl { get; set; } = string.Empty;
}
