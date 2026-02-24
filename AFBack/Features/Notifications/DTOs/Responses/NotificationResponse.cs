using AFBack.Common.DTOs;
using AFBack.Features.Notifications.Enums;

namespace AFBack.Features.Notifications.DTOs.Responses;

/// <summary>
/// Response for en notifikasjon til frontend
/// </summary>
public class NotificationResponse
{
    public int Id { get; set; }
    public NotificationEventType Type { get; set; }
    public string Summary { get; set; } = null!;
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }
    public UserSummaryDto? RelatedUserSummaryDto { get; set; }
}
