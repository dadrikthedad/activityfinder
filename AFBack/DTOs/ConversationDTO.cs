namespace AFBack.DTOs;

public class ConversationDTO
{
    public int Id { get; set; }
    public string? GroupName { get; set; }
    public bool IsGroup { get; set; }
    
    public List<UserSummaryDTO> Participants { get; set; } = new();
    public DateTime? LastMessageSentAt { get; set; }
    
    public bool IsApproved { get; set; }
    
    public bool IsPendingApproval { get; set; } 

}