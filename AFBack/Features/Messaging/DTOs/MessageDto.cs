using AFBack.Features.Reactions.DTOs;
using AFBack.Features.Reactions.DTOs.Responses;

namespace AFBack.Features.Messaging.DTOs;

/// <summary>
/// Intern DTO for message-data fra databasen. Brukes som mellomformat mellom Repository og Service-lag.
/// MessageResponse er det frontend forventer
/// </summary>
public class MessageDto
{
    public int Id { get; set; }
    public string? SenderId { get; set; }
    public string? EncryptedText { get; set; }
    public string KeyInfo { get; set; } = null!;
    public string IV { get; set; } = null!;
    public int Version { get; set; }
    public DateTime SentAt { get; set; }
    public int ConversationId { get; set; }
    public bool IsDeleted { get; set; }
    public int? ParentMessageId { get; set; }
    public string? ParentMessagePreview { get; set; }
    public bool IsSystemMessage { get; set; }
    public string? ParentSenderId { get; set; }
    
    public List<AttachmentDto> Attachments { get; set; } = new();
    public List<ReactionResponse> Reactions { get; set; } = new();
}
