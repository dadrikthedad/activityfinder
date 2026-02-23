using System.Text.Json.Serialization;
using AFBack.Common.DTOs;
using AFBack.Models;

namespace AFBack.DTOs;

public class NotificationDTO
{
    public int Id { get; set; }
    
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public NotificationEntityType Type { get; set; }
    public string? Message { get; set; }
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }
    
    // Navigasjonsegenskaper - sender med bruker id, fultnavn og bilde som blir da synlig ved en forespørsel
    public UserSummaryDto? RelatedUser { get; set; } = null!;
    
    public int? PostId { get; set; }
    public int? CommentId { get; set; }
    public int? FriendInvitationId { get; set; }
    public int? EventInvitationId { get; set; }
    
}