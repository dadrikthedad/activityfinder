using AFBack.Models;

namespace AFBack.DTOs;

public class PublicProfileDTO
{
   
    // BrukerID fra user.cs
    public int UserId { get; set; }
    // Siden vi bruker samme Get til både bruker og andre brukere så må vi sjekke om det er eieren
    public bool IsOwner { get; set; }
    // Navn fra User.cs
    public string FirstName { get; set; } = null!;
    public string? MiddleName { get; set; }
    public string LastName { get; set; } = null!;
    public string FullName { get; set; }
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
    // postalcode fra user.cs
    public string? PostalCode { get; set; }
    // fødselsår fra user.cs
    public DateTime DateOfBirth { get; set; }
    public int? Age { get; set; }
    // kjønn fra User.cs
    public Gender? Gender { get; set; }
    // kontaktinfo fra Profile
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
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
    public bool ShowAge { get; set; }
    
    public bool ShowBirthday { get; set; }
    public bool ShowGender { get; set; } = true;
    public bool ShowEmail { get; set; } = false;
    public bool ShowPhone { get; set; } = false;
    public bool ShowRegion { get; set; } = true;
    
    public bool ShowStats { get; set; } = true;
    
    public bool ShowWebsites { get; set; } = true;
    public bool ShowPostalCode { get; set; } = false;
    
    public string Language { get; set; } = "en";
    public bool RecieveEmailNotifications { get; set; } = true;
    public bool RecievePushNotifications { get; set; } = true;
}