namespace AFBack.Models;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
// Profile til brukeren, her kan de endre det som blir synlig for folk, samt at vi henter feks Age og Navn fra User.cs
public class Profile
{
    // UserId blir primærnøkkel så slipper vi å ta en egen primærnøkkel og vi vil aldri bytte ut profil-sider til en bruker.
    [Key, ForeignKey("User")]
    public int UserId { get; set; }
    
    // Gjør at vi kan hente ut alt fra User i profile.cs
    public User User { get; set; } = null!;
    
    // Bilde blir lagret som en Url
    [MaxLength(500)]
    public string? ProfileImageUrl { get; set; }
    
    // Bio er tekst
    [MaxLength(1000)]
    public string? Bio { get; set; }
    
    // WebSitesCsv lagres i databasen, og det er lettere å lagre en lang string kontra en liste.
    [MaxLength(500)]
    public string? WebsitesCsv { get; set; }
    
    public List<string> Websites => WebsitesCsv?.Split(',').ToList() ?? new List<string>();
    // Setter listen med Websistes tilbake til WebsitesCsv som lagres i databasen
    public void SetWebsites(List<string> websites)
    {
        WebsitesCsv = string.Join(",", websites.Select(w => w.Trim()));
    }
    
    [EmailAddress]
    [MaxLength(100)]
    // Epost til feks support/kontakt
    public string? ContactEmail { get; set; }
    
    [MaxLength(30)]
    // Epost til feks support/kontakt
    public string? ContactPhone { get; set; }
    
    // Sist brukeren gjorde endringer
    public DateTime? UpdatedAt { get; set; }
    
    // Listen med alle venner
    [NotMapped]
    public List<User>? Friends { get; set; }
    
    // Aktiviteter brukeren er interresert i
    public List<UserActivity>? Activities { get; set; }
    
    // Communitites brukeren er medlem av
    public List<Community>? Communities { get; set; }
    
    // Antall likes brukeren har gitt. Kun for statistikk
    public int TotalLikesGiven { get; set; } = 0;
    
    // Antall likes brukeren har fått. Kun for statistikk
    public int TotalLikesRecieved { get; set; } = 0;
    
    // Antall kommentarer lagd
    public int TotalCommentsMade { get; set; } = 0;
    
    // Totale meldinger
    public int TotalMessagesRecieved { get; set; } = 0;
    // Totale meldinger sendt
    public int TotalMessagesSendt { get; set; }
    
    
    
}
