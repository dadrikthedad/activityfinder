using System.Text.Json.Serialization;
using AFBack.Models;

namespace AFBack.DTOs;

public class MessageRequestCreatedDto
{
    [JsonPropertyName("senderId")]
    public int SenderId { get; set; }

    [JsonPropertyName("receiverId")]
    public int ReceiverId { get; set; }

    [JsonPropertyName("conversationId")]
    public int ConversationId { get; set; }
    
    // Valgfri notification
    public MessageNotificationDTO? Notification { get; set; }
}