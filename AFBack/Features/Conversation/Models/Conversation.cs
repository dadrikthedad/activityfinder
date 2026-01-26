using System.ComponentModel.DataAnnotations;
using AFBack.Models.Enums;

namespace AFBack.Features.Conversation.Models;

public class Conversation
{
    // ======================== PRIMÆRNØKKEL ========================
    public int Id { get; set; }
    
    // ======================== Properties ========================
    
    public DateTime? LastMessageSentAt { get; set; } 
    
    public ConversationType Type { get; set; }
    
    // ======================== Group Conversation Data ========================
    
    [MaxLength(100)]
    public string? GroupName { get; set; }
    
    [MaxLength(512)]
    public string? GroupImageUrl { get; set; }
    
    [MaxLength(1000)]
    public string? GroupDescription { get; set; }
    
    // ======================== Group disbanded ========================
    public bool IsDisbanded { get; set; }
    
    public DateTime? DisbandedAt { get; set; }
    
    // ======================== Navigasjonsegenskaper ========================
    public ICollection<CanSend.Models.CanSend> CanSend { get; set; } = new List<CanSend.Models.CanSend>();
    public ICollection<ConversationParticipant> Participants { get; set; } = new List<ConversationParticipant>();
    public ICollection<Messaging.Models.Message> Messages { get; set; } = new List<Messaging.Models.Message>();
    public ICollection<ConversationLeftRecord> LeftGroupRecords { get; set; } = new List<ConversationLeftRecord>();
}
