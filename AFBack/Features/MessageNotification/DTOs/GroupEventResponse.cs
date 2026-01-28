using AFBack.Features.MessageNotification.Models.Enum;

namespace AFBack.Features.MessageNotification.DTOs;

/// <summary>
/// Response med eventene til et MessageNotification for en gruppe
/// </summary>
public class GroupEventResponse
{
    public int Id { get; set; }
    public GroupEventType Type { get; set; }
    public string Summary { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
