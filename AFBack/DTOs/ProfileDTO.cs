namespace AFBack.DTOs;

public class ProfileDTO
{
    public int UserId { get; set; }
    
    public string? ProfileImageUrl { get; set; }
    
    public string? Bio { get; set; }
    
    public string? Gender { get; set; }

    public List<string> Websites { get; set; } = new();
    
    public string? Location { get; set; }
    
    public DateTime? UpdatedAt { get; set; }
    
    public bool IsOnline { get; set; }
    
    public int TotalLikesGiven { get; set; }
    
    public int TotalLikesRecieved { get; set; }
    
    public int TotalCommentsMade { get; set; }
    
    public int TotalMessagesRecieved { get; set; }
    
    public int TotalMessagesSendt { get; set; }
    
    public DateTime? LastSeen { get; set; }
}