namespace AFBack.DTOs;

public class UnreadSummaryDTO
{
    public int TotalUnread { get; set; }
    public Dictionary<int, int> PerConversation { get; set; } = new();
}