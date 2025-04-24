namespace AFBack.DTOs;

public class NotificationDTO
{
    public int Id { get; set; }
    public string Type { get; set; } = string.Empty;
    public string? Message { get; set; }
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }
    
    // Navigasjonsegenskaper - sender med bruker id, fultnavn og bilde som blir da synlig ved en forespørsel
    public UserSummaryDTO? RelatedUser { get; set; } = null!;
}