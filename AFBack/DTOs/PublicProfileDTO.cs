namespace AFBack.DTOs;

public class PublicProfileDTO
{
   
    // BrukerID fra user.cs
    public int UserId { get; set; }
    // Siden vi bruker samme Get til både bruker og andre brukere så må vi sjekke om det er eieren
    public bool IsOwner { get; set; }
    // Navn fra User.cs
    public string? FullName { get; set; }
    // Bilde fra Profile.cs
    public string? ProfileImageUrl { get; set; }
    // bio fra Profile.cs
    public string? Bio { get; set; }
    // websites fra Profile.cs
    public List<string> Websites { get; set; } = new();
    // land fra User.cs
    public string? Country { get; set; }
    // region fra User.cs
    public string? Region { get; set; }
    // stats fra Profile.cs
    public int TotalLikesGiven { get; set; }
    public int TotalLikesRecieved { get; set; }
    public int TotalCommentsMade { get; set; }
    public int TotalMessagesRecieved { get; set; }
    public int TotalMessagesSendt { get; set; }
    // Trenger jeg denne egentlig? Er fra User.cs
    public DateTime? LastSeen { get; set; }
    // Denne trenger jeg nok ikke
    public DateTime? UpdatedAt { get; set; }
    // Innstillinger til profile-layout fra UserSettings.cs
    public bool PublicProfile { get; set; } = true;
    public bool ShowGender { get; set; } = true;
    public bool ShowEmail { get; set; } = false;
    public bool ShowPhone { get; set; } = false;
    public bool ShowRegion { get; set; } = true;
}