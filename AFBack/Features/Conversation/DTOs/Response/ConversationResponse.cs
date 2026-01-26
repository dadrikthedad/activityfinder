using AFBack.Models.Enums;

namespace AFBack.Features.Conversation.DTOs.Response;

/// <summary>
/// Egenskapene frontend trenger relevant til en samtale
/// </summary>
public class ConversationResponse
{
    public int Id { get; set; }
    
    // ======================== Properties ========================
    public DateTime? LastMessageSentAt { get; set; } 
    
    public ConversationType Type { get; set; }
    
    // ======================== Group Conversation Data ========================
    public string? GroupName { get; set; }
    public string? GroupImageUrl { get; set; }
    
    // ======================== Participants ========================
    
    public List<ParticipantResponse> Participants { get; set; } = new();
}
