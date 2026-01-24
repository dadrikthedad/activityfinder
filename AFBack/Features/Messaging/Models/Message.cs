using System.ComponentModel.DataAnnotations;
using AFBack.Models;
using AFBack.Models.Auth;

namespace AFBack.Features.Messaging.Models;

public class Message
{
    // ======================== PRIMÆRNØKKEL ========================
    public int Id { get; set; }
    
    // ======================== Foreign Keys ========================
    public int ConversationId { get; set; }
    [MaxLength(100)]
    public string? SenderId { get; set; }
    
    // ======================== EncryptionData ========================
        
    // Encrypted content - can be null for attachment-only messages
    [MaxLength(100000)]
    public string? EncryptedText { get; set; }
        
    [Required]
    [MaxLength(2000)]
    public string KeyInfo { get; set; } = "{}"; // JSON string of encrypted keys
        
    [Required]
    [MaxLength(100)]
    public string IV { get; set; } = string.Empty;
        
    public int Version { get; set; } = 1;
    public DateTime SentAt { get; set; } = DateTime.UtcNow;
        
    
    // ======================== Parent Message (not encrypted) ========================
    public int? ParentMessageId { get; set; }
    [MaxLength(1000)]
    public string? ParentMessagePreview { get; set; } // Truncated preview for threading
        
    // ======================== System Flags ========================
    public bool IsSystemMessage { get; set; }
    public bool IsDeleted { get; set; }
        
    // ======================== Navigasjonsegenskaper ========================
    public AppUser? Sender { get; set; }
    public Features.Conversation.Models.Conversation Conversation { get; set; } = null!;
    public Message? ParentMessage { get; set; } 
    public ICollection<MessageAttachment> Attachments { get; set; } = new List<MessageAttachment>();
    public ICollection<Reaction> Reactions { get; set; } = new List<Reaction>();
    
}
