using System.ComponentModel.DataAnnotations;
using AFBack.Features.Auth.Models;
using AFBack.Models.Enums;

namespace AFBack.Features.CanSend.Models;

public class CanSend
{
    // ======================== PRIMÆRNØKKEL ========================
    [Required, MaxLength(100)]
    public string UserId { get; set; } = null!;
    public int ConversationId { get; set; }
    
    // ======================== CanSend data ========================
    public DateTime ApprovedAt { get; set; } = DateTime.UtcNow;
    
    public CanSendReason Reason { get; set; } = CanSendReason.MessageRequest;
    
    public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
    
    // ======================== Navigasjonsegenskaper ========================
    public AppUser AppUser { get; set; } = null!;
    public Features.Conversation.Models.Conversation Conversation { get; set; } = null!;
}


