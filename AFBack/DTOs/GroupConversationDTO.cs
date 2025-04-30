namespace AFBack.DTOs;

public class GroupConversationDTO
{
    public int Id { get; set; }
    public string? GroupName { get; set; }
    public List<UserSummaryDTO> Participants { get; set; } = new();
}