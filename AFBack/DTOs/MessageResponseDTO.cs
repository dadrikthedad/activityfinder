namespace AFBack.DTOs;

public class MessageResponseDto
{
    public string Id { get; set; } = string.Empty;
    public int? SenderId { get; set; }
    public UserSummaryDto Sender { get; set; } = null!;
    public string? Text { get; set; }
    public DateTime SentAt { get; set; }
    public int ConversationId { get; set; }  
    public List<AttachmentDto> Attachments { get; set; } = [];
    public List<ReactionDto> Reactions { get; set; } = [];
    public int? ParentMessageId { get; set; } 
    public string? ParentMessageText { get; set; } 
    public UserSummaryDto? ParentSender { get; set; }
    public bool IsSilent { get; set; }
    
    public bool IsSystemMessage { get; set; }
    
    public bool IsDeleted { get; set; } = false;
}
