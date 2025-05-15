namespace AFBack.DTOs;

public class ConversationDTO
{
    public int Id { get; set; }
    public string? GroupName { get; set; }
    public bool IsGroup { get; set; }
    
    public List<UserSummaryDTO> Participants { get; set; } = new();
    
    public int CreatorId { get; set; } // Hvem som opprettet samtalen

    public bool IsApproved { get; set; } // Er samtalen godkjent (for én-til-én)
    
    public DateTime? LastMessageSentAt { get; set; } // For å gjøre det lett å sortere

    private bool HasUnreadMessages { get; set; } // For å se om vi har uleste meldinger her
    
    public bool IsPendingApproval { get; set; } 

}