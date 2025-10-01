using AFBack.DTOs;
using AFBack.DTOs.Crypto;

namespace AFBack.Features.MessageBroadcast.DTO.cs;

// TODO: Tenker at denne er standard MessageDTO/Response for alle Message-objekter
public class EncryptedMessageBroadcastResponse
{
    public int Id { get; set; }
    public int? SenderId { get; set; }
    public string? EncryptedText { get; set; }
    public Dictionary<string, string> KeyInfo { get; set; } = new();
    public string IV { get; set; } = string.Empty;
    public int Version { get; set; }
    public DateTime SentAt { get; set; }
    public int ConversationId { get; set; }
    public List<EncryptedAttachmentBroadcastResponse> EncryptedAttachments { get; set; } = new();
    public int? ParentMessageId { get; set; }
    public string? ParentMessagePreview { get; set; }
    public bool IsSystemMessage { get; set; }
    public bool IsDeleted { get; set; }
    
    public List<ReactionDTO> Reactions { get; set; } = new();
    public UserSummaryDTO? ParentSender { get; set; }
    public UserSummaryDTO? Sender { get; set; }
    public bool? IsSilent { get; set; }
}