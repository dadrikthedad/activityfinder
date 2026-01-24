using System.ComponentModel.DataAnnotations;
using AFBack.Models;
using AFBack.Models.Auth;
using AFBack.Models.Enums;
namespace AFBack.Features.MessageNotification.Models;

public class MessageNotification
{
    // ======================== PRIMÆRNØKKEL ========================
    public int Id { get; set; }
    
    // ======================== Sender og mottaker ========================
    [MaxLength(100)]
    public string RecipientId { get; set; } = string.Empty; // Den som skal motta varselet
    
    [MaxLength(100)]
    public string? SenderId { get; set; } // Hvem som trigget varselet. Bruker eller systemmelding
    
    // ======================== Foreign Keys ========================
    public int? MessageId { get; set; }
    public int ConversationId { get; set; }

    
    // ======================== MessageNotificationData ========================
    public MessageNotificationType Type { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public bool IsRead { get; set; }
    public DateTime? ReadAt { get; set; }
    
    // ======================== New or Aggregate Notification Properties ========================
    public int MessageCount { get; set; } = 1;// Øker MessageCount ved ny notifikasjon istedenfor å lage ny notifikasjon
    public int? EventCount { get; set; }
    public DateTime? LastUpdatedAt { get; set; }
    
    // ======================== Navigasjonsegenskaper ========================
    public AppUser? RecipientUser { get; set; }  
    public AppUser? SenderUser { get; set; }
    public Messaging.Models.Message? Message { get; set; }
    public Conversation.Models.Conversation? Conversation { get; set; }
    public ICollection<MessageNotificationGroupEvent> GroupEvents { get; set; } = [];
    
}

