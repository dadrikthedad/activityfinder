using System.Text.Json.Serialization;

namespace AFBack.Models;

public class MessageNotificationDTO
{
    public int Id { get; set; }
    
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public NotificationType Type { get; set; }
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ReadAt { get; set; }

    public int? MessageId { get; set; }
    public int? ConversationId { get; set; }
    public int? SenderId { get; set; }
    public string? SenderName { get; set; }
    
    public string? SenderProfileImageUrl { get; set; }
    public string? GroupName { get; set; }
    
    public string? GroupImageUrl { get; set; }
    
    [JsonPropertyName("reactionEmoji")]
    public string? ReactionEmoji { get; set; }
    
    public bool IsReactionUpdate { get; set; } = false;

    public string? MessagePreview { get; set; } // For "Ola: Hei!"-type visninger
    public int? MessageCount { get; set; }
    
    public bool? IsConversationRejected { get; set; }
    // Visning av hendelser
    public List<string>? EventSummaries { get; set; }
}