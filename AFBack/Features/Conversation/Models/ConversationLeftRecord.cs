using System.ComponentModel.DataAnnotations;
using AFBack.Models.Auth;

namespace AFBack.Features.Conversation.Models;

public class ConversationLeftRecord
{
    // ======================== PRIMÆRNØKKEL ========================
    [Required, MaxLength(100)]
    public string UserId { get; set; } = null!;
    
    public int ConversationId { get; set; }
    
    // ======================== Metadata ========================
    public DateTime LeftAt { get; set; } = DateTime.UtcNow;
    
    // ======================== Navigasjonsegenskaper ========================
    public AppUser User { get; set; } = null!;
    public Conversation Conversation { get; set; } = null!;
}
