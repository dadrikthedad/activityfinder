namespace AFBack.DTOs;

public class GroupNotificationDTO
{
    public int Id { get; set; }
    public int ConversationId { get; set; }
    public string GroupName { get; set; } = string.Empty;
    public string? GroupImageUrl { get; set; }
    public int EventCount { get; set; }
    public DateTime LastUpdatedAt { get; set; }
    public List<string> EventSummaries { get; set; } = new();
    
    public List<int> GroupEventIds { get; set; } = new();
}

// SignalR DTO for å sende live oppdateringer
public class GroupNotificationUpdateDTO
{
    public int UserId { get; set; }
    public GroupNotificationDTO Notification { get; set; } = null!;
    public bool IsNewNotification { get; set; } // true hvis dette er en helt ny notifikasjon
}