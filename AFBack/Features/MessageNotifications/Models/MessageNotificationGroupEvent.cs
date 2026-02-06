using System.ComponentModel.DataAnnotations;


namespace AFBack.Features.MessageNotification.Models;

public class MessageNotificationGroupEvent
{
    [Required]
    public int MessageNotificationId { get; set; }
    
    [Required]
    public int GroupEventId { get; set; }
    
    
    public MessageNotifications.Models.MessageNotification MessageNotification { get; set; } = null!;
    public GroupEvent GroupEvent { get; set; } = null!;
}
