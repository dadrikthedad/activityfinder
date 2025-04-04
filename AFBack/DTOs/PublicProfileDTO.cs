namespace AFBack.DTOs;

public class PublicProfileDTO
{
    public int UserId { get; set; }
    public string? FullName { get; set; }
    public string? ProfileImageUrl { get; set; }
    public string? Bio { get; set; }
    public List<string> Websites { get; set; } = new();
    public string? Country { get; set; }
    public string? Region { get; set; }
    
    public int TotalLikesGiven { get; set; }
    
    public int TotalLikesRecieved { get; set; }
    
    public int TotalCommentsMade { get; set; }
    
    public int TotalMessagesRecieved { get; set; }
    
    public int TotalMessagesSendt { get; set; }
    
    public DateTime? LastSeen { get; set; }

    public DateTime? UpdatedAt { get; set; }
}