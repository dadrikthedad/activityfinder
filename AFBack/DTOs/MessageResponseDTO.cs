namespace AFBack.DTOs;

public class MessageResponseDTO
{
    public int Id { get; set; }
    public int SenderId { get; set; }
    public UserSummaryDTO Sender { get; set; } = null!;
    public string? Text { get; set; }
    public DateTime SentAt { get; set; }
    public int ConversationId { get; set; }  
    public List<AttachmentDto> Attachments { get; set; } = new();
    public List<ReactionDTO> Reactions { get; set; } = new();
    
    public int? ParentMessageId { get; set; } // 👈 referanse til svaret
    public string? ParentMessageText { get; set; } // valgfritt for visning
    // Hvis brukeren har avslått meldingsforespørsel så må vi ikke legge samtalen inn i store
    public bool IsRejectedRequest { get; set; } = false;
}