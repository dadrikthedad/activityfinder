using AFBack.Common.DTOs;
using AFBack.Features.Reactions.DTOs.Responses;

namespace AFBack.Features.Messaging.DTOs.Response;

/// <summary>
/// Alt frontend trenger for hver melding
/// </summary>
public record MessageResponse
{   
    // ==================== Meldingsdata ==================== 
    public int Id { get; set; }
    public DateTime SentAt { get; set; }
    public int ConversationId { get; set; }
    
    // ==================== Synlighet/slettet data ==================== 
    public bool IsSystemMessage { get; set; }
    public bool IsDeleted { get; set; }
    public bool? IsSilent { get; set; }
    
    // ==================== Avsender data ==================== 
    public string? SenderId { get; set; }
    public UserSummaryDto? Sender { get; set; }
    
    // ==================== ParentMessage ==================== 
    public int? ParentMessageId { get; set; }
    public string? ParentMessagePreview { get; set; }
    public UserSummaryDto? ParentSender { get; set; }
    
    // ==================== Encryption ==================== 
    public string? EncryptedText { get; set; }
    public Dictionary<string, string> KeyInfo { get; set; } = new();
    public string IV { get; set; } = string.Empty;
    public int Version { get; set; }
    
    // ==================== Vedlegg/reaksjoner ==================== 
    public List<AttachmentResponse> EncryptedAttachments { get; set; } = [];
    public List<ReactionResponse> Reactions { get; set; } = [];
    
}
