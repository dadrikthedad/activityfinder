using AFBack.Models;

namespace AFBack.DTOs;

public class GroupDisbandedDto
{
    public int ConversationId { get; set; }
    public string GroupName { get; set; } = string.Empty;
    public string? GroupImageUrl { get; set; }
    public DateTime DisbandedAt { get; set; }
    public MessageNotificationDTO? Notification { get; set; }
}