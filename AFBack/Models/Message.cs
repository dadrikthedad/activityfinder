using System.ComponentModel.DataAnnotations;
using AFBack.Models.Crypto;

namespace AFBack.Models;

public class Message
{
    public int Id { get; set; }
    public int? SenderId { get; set; }
    public User? Sender { get; set; }
        
    // Encrypted content - can be null for attachment-only messages
    public string? EncryptedText { get; set; }
        
    [Required]
    public string KeyInfo { get; set; } = "{}"; // JSON string of encrypted keys
        
    [Required]
    public string IV { get; set; } = string.Empty;
        
    public int Version { get; set; } = 1;
    public DateTime SentAt { get; set; } = DateTime.UtcNow;
        
    [Required]
    public int ConversationId { get; set; }
    public Conversation Conversation { get; set; }
    
    public bool IsApproved { get; set; } = true; 
        
    // Parent message for replies (metadata, not encrypted)
    public int? ParentMessageId { get; set; }
    public string? ParentMessagePreview { get; set; } // Truncated preview for threading
        
    // System flags
    public bool IsSystemMessage { get; set; } = false;
    public bool IsDeleted { get; set; } = false;
        
    // Navigation properties
    public ICollection<MessageAttachment> Attachments { get; set; } = new List<MessageAttachment>();
    public ICollection<Reaction> Reactions { get; set; } = new List<Reaction>();
    public Message? ParentMessage { get; set; } 
}