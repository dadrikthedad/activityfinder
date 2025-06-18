using System.Text.Json.Serialization;
using AFBack.Models;

namespace AFBack.DTOs;

public class GroupRequestCreatedDto
{
    [JsonPropertyName("groupRequestId")]
    public int GroupRequestId { get; set; }

    [JsonPropertyName("senderId")]
    public int SenderId { get; set; }

    [JsonPropertyName("receiverId")]
    public int ReceiverId { get; set; }

    [JsonPropertyName("conversationId")]
    public int ConversationId { get; set; }

    [JsonPropertyName("groupName")]
    public string GroupName { get; set; } = null!;

    [JsonPropertyName("groupImageUrl")]
    public string? GroupImageUrl { get; set; }

    [JsonPropertyName("creatorId")]
    public int CreatorId { get; set; }

    [JsonPropertyName("requestedAt")]
    public DateTime RequestedAt { get; set; }

    // Valgfri notification
    [JsonPropertyName("notification")]
    public MessageNotificationDTO? Notification { get; set; }
}