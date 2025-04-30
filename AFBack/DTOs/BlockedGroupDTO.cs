namespace AFBack.DTOs;

public class BlockedGroupDTO
{
    public int ConversationId { get; set; }
    public string GroupName { get; set; } = string.Empty;
    public DateTime BlockedAt { get; set; }
}