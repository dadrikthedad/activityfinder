using System.ComponentModel.DataAnnotations;

namespace AFBack.Models;

public class GroupRequest
{
    public int Id { get; set; }
    public int SenderId { get; set; }
    
    public int ReceiverId { get; set; }
    
    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
    
    
    public GroupRequestStatus Status { get; set; } = GroupRequestStatus.Pending;
    public bool IsRead { get; set; } = false;
    
    public int ConversationId { get; set; } // Settes når gruppen opprettes
    public Conversation Conversation { get; set; }
    
    public User Sender { get; set; } = null!;
    
    public User Receiver { get; set; } = null!;
    
}

public enum GroupRequestStatus
{
    Pending,
    Approved,
    Rejected
}
