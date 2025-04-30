namespace AFBack.DTOs;

public class MessageRequestDTO
{
    public int SenderId { get; set; }
    public string SenderName { get; set; } = string.Empty;
    public string? ProfileImageUrl { get; set; }
    public DateTime RequestedAt { get; set; }
}