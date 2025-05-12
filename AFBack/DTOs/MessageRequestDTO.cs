namespace AFBack.DTOs;
// For meldinger mellom brukere eller grupper
public class MessageRequestDTO
{
    public int SenderId { get; set; }
    public string SenderName { get; set; } = string.Empty;
    public string? ProfileImageUrl { get; set; }
    public DateTime RequestedAt { get; set; }
    
    public int? ConversationId { get; set; }
    public string? GroupName { get; set; }
    public bool IsGroup { get; set; }
    public bool LimitReached { get; set; }
}