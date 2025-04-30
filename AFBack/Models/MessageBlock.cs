namespace AFBack.Models;

public class MessageBlock
{
    public int Id { get; set; }
    public int BlockerId { get; set; } // Den som avviste
    public int BlockedUserId { get; set; } // Den som ble avvist
    public DateTime BlockedAt { get; set; } = DateTime.UtcNow;
    
    public User BlockedUser { get; set; } = null!;
}
