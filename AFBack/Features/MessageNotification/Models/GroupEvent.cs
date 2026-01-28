using System.ComponentModel.DataAnnotations;
using AFBack.Features.MessageNotification.Models.Enum;
using AFBack.Models.Auth;

namespace AFBack.Features.MessageNotification.Models;

public class GroupEvent
{
    // ======================== PRIMÆRNØKKEL ========================
    public int Id { get; set; }
    
    // ======================== Foreign Keys ========================
    [Required] 
    public int ConversationId { get; set; }
    
    [Required]
    [MaxLength(100, ErrorMessage = "UserId cannot be more than 100 characters")]
    public string TriggeredByUserId { get; set; } = string.Empty;
    
    // ======================== GroupEvent Data ========================
    [Required] 
    public GroupEventType EventType { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [MaxLength(3000, ErrorMessage = "Preview cannot be more than 3000 characters")]
    public string Summary { get; set; } = string.Empty;
    
    // ======================== Navigasjonsegenskaper ========================
    public Features.Conversation.Models.Conversation Conversation { get; set; } = null!;
    
    public AppUser TriggeredByUser { get; set; } = null!;
}

