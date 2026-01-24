using System.ComponentModel.DataAnnotations;
using AFBack.Models.Auth;

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
    public Features.Conversation.Models.Conversation Conversation { get; set; }
    
    public AppUser Sender { get; set; } = null!;
    
    public AppUser Receiver { get; set; } = null!;
    
}

public enum GroupRequestStatus 
{ 
    Pending = 0,
    Approved = 1, 
    Rejected = 2,
    Creator = 3
}
