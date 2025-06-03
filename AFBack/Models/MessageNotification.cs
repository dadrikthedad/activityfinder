namespace AFBack.Models;

public class MessageNotification
{
    public int Id { get; set; }

    public int UserId { get; set; } // Den som skal motta varselet
    public User User { get; set; }  // Navigasjon

    public NotificationType Type { get; set; }

    public int? FromUserId { get; set; } // Hvem som trigget varselet
    public User? FromUser { get; set; }

    public int? MessageId { get; set; }
    public Message? Message { get; set; }

    public int? ConversationId { get; set; }
    public Conversation? Conversation { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public bool IsRead { get; set; } = false;
    public DateTime? ReadAt { get; set; }
    // Aggrere en meldingsnotification ved nye meldinger istedenfor å lage mange nye notifications
    public int? MessageCount { get; set; }
}

public enum NotificationType
{
    NewMessage = 1,
    MessageRequest = 2,
    MessageRequestApproved = 3,
    MessageReaction = 4
}