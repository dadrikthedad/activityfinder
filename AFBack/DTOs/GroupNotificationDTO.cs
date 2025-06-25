using AFBack.Models;

namespace AFBack.DTOs;

// SignalR DTO for å sende live oppdateringer
public class GroupNotificationUpdateDTO
{
    public int UserId { get; set; }
    public MessageNotificationDTO Notification { get; set; } = null!;
    public bool IsNewNotification { get; set; } // true hvis dette er en helt ny notifikasjon
    
    public GroupEventType GroupEventType { get; set; } // Forteller hvilken eventtype det er til frontend for 
    
    public List<string> AffectedUserNames { get; set; } = new(); // Påvirkede brukere, de som har blitt invitert
}

