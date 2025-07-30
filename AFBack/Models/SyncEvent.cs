using System.ComponentModel.DataAnnotations;
using System.Text.Json;

namespace AFBack.Models;

public class SyncEvent
{
    [Key]
    public int Id { get; set; }
    
    [Required]
    public int UserId { get; set; }
    
    [Required]
    [MaxLength(50)]
    public string EventType { get; set; }
    
    [Required]
    public string EventData { get; set; } // JSON string
    
    [Required]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    [Required]
    [MaxLength(200)]
    public string SyncToken { get; set; }
    
    // Optional: for debugging and cleanup
    [MaxLength(200)]
    public string? Source { get; set; } // "SignalR", "API", etc.
    
    public int? RelatedEntityId { get; set; } // ConversationId, MessageId, etc.
    
    [MaxLength(50)]
    public string? RelatedEntityType { get; set; } // "Message", "Conversation", etc.
    
    // Navigation property
    public virtual User User { get; set; }
    
    public TimeSpan Age => DateTime.UtcNow - CreatedAt;
    
    // Check if event is recent (for performance optimizations)
    public bool IsRecent => Age < TimeSpan.FromMinutes(5);
}