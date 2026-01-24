using System.ComponentModel.DataAnnotations;
using AFBack.Models.Auth;

namespace AFBack.Models.Conversation;

public class ConversationLeftRecord
{
    // ======================== PRIMÆRNØKKEL ========================
    [Required, MaxLength(100)]
    public string UserId { get; set; } = null!;
    
    public int ConversationId { get; set; }
    
    // ======================== Metadata ========================
    public DateTime LeftAt { get; set; } = DateTime.UtcNow;
    
    // ======================== Navigasjonsegenskaper ========================
    public AppUser AppUser { get; set; } = null!;
    public Features.Conversation.Models.Conversation Conversation { get; set; } = null!;
}
