namespace AFBack.DTOs.Attachment;

public class AttachmentDTO
{
    public int Id { get; set; }
    public string FileUrl { get; set; } = null!;
    public string? FileName { get; set; }
    public string FileType { get; set; } = null!;
    public long? FileSize { get; set; }
    public DateTime UploadedAt { get; set; }
}