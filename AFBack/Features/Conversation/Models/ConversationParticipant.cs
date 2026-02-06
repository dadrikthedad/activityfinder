using System.ComponentModel.DataAnnotations;
using AFBack.Features.Auth.Models;
using AFBack.Models.Enums;

namespace AFBack.Features.Conversation.Models;

public class ConversationParticipant
{
    // ======================== PRIMÆRNØKKEL ========================
    [Required, MaxLength(100)]
    public string UserId { get; set; } = null!;
    public int ConversationId { get; set; }
    
    // ======================== Tillatelser ========================
    public ConversationStatus Status { get; set; }
    public ParticipantRole Role { get; set; }
    
    // ======================== Limit på meldinger før godkjennelse ========================
    
    public int? PendingMessagesReceived { get; set; } = 0;
    
    // ======================== Archived/Soft delete/Hidden ========================
    public bool ConversationArchived { get; set; } // 1-1 samtaler
    public DateTime? ArchivedAt { get; set; } // Hvis brukeren har forlatt 1-1 samtalen, med grupper så er man ikke 
                                             // medlem av samtalen lenger
    
    // ======================== TimeStamps (for grupper) ========================
    public DateTime InvitedAt { get; set; } = DateTime.UtcNow; // Når brukeren ble pending
    public DateTime? JoinedAt { get; set; } = DateTime.UtcNow; // Når brukeren aksepterte
    
    // ======================== Navigasjonsegenskaper ========================
    public AppUser AppUser { get; set; } = null!;
    public Conversation Conversation { get; set; } = null!;
}


