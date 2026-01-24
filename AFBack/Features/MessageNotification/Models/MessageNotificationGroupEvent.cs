using System.ComponentModel.DataAnnotations;
using AFBack.Features.MessageNotification.Models;

namespace AFBack.Models;

public class MessageNotificationGroupEvent
{
    public int Id { get; set; }
    
    [Required]
    public int MessageNotificationId { get; set; }
    public MessageNotification MessageNotification { get; set; } = null!;
    
    [Required]
    public int GroupEventId { get; set; }
    public GroupEvent GroupEvent { get; set; } = null!;
}
