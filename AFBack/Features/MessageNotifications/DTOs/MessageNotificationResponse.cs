using System.Text.Json.Serialization;
using AFBack.Common.DTOs;
using AFBack.DTOs;
using AFBack.Features.MessageNotification.Models.Enum;

namespace AFBack.Features.MessageNotifications.DTOs;

public class MessageNotificationResponse
{
    // ==================== MessageNotificationData ==================== 
    public int Id { get; set; }
    
    // ==================== Samtalen notifikasjonen hører til ==================== 
    
    public int ConversationId { get; set; }
    
    public MessageNotificationType Type { get; set; }
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ReadAt { get; set; }
    
    // ==================== Hvis det eksisterer en lignende MessageNotificaiton fra før ==================== 
    public DateTime? LastUpdatedAt { get; set; }
    
    // ==================== NewMessage Data ==================== 

    public int? MessageId { get; set; }
    public string? Summary { get; set; } // For "Ola: Hei!"-type visninger
    public int? MessageCount { get; set; }
    
    // ==================== Brukeren som har trigget oppretting av notifikasjonen ==================== 

    public UserSummaryDto SenderUserDto { get; set; } = new();
  
    // ==================== Gruppe Egenskaper ==================== 
    
    public string? GroupName { get; set; }
    public string? GroupImageUrl { get; set; }
    
    // ==================== Emoji Egenskaper ==================== 
    
    [JsonPropertyName("reactionEmoji")]
    public string? ReactionEmoji { get; set; }
    
    public bool IsReactionUpdate { get; set; } = false;
    
    // ==================== Gruppe Event egenskaper ==================== // 
    public int? EventCount { get; set; }            // For GroupEvent notifikasjoner
    // Visning av hendelser
    public List<GroupEventResponse>? GroupEvents { get; set; } 
    
    // For å ha riktig notification ved kun 1 groupevent
    public string? LatestGroupEventType { get; set; }
}
