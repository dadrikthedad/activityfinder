using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.MessageNotifications.Models;

public class MessageNotificationGroupEvent
{
    // ======================== Compound Primary Key ========================
    public int MessageNotificationId { get; set; }
    public int GroupEventId { get; set; }
    
    // ======================== Navigasjonsegenskaper ========================
    public MessageNotification MessageNotification { get; set; } = null!;
    public GroupEvent GroupEvent { get; set; } = null!;
}
