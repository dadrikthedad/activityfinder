using AFBack.Models.Enums;

namespace AFBack.Features.Conversation.DTOs;

/// <summary>
/// Intern data-modell som representerer conversation-data fra databasen og brukes som mellomformat mellom lag.
/// ConversationResponse er formatet frontend forventer
/// </summary>
public class ConversationDto
{
    public int Id { get; set; }
    
    // ======================== Properties ========================
    public DateTime? LastMessageSentAt { get; set; } 
    
    public ConversationType Type { get; set; }
    
    // ======================== Group Conversation Data ========================
    public string? GroupName { get; set; }
    public string? GroupImageUrl { get; set; }
    
    // ======================== Participants ========================
    
    public List<ParticipantDto> Participants { get; set; } = new();
    
    
}

