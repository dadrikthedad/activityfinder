using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AFBack.Features.Auth.Models;
using AFBack.Models.Enums;

namespace AFBack.Features.Profile.Models;

public class UserProfile
{
    // ======================== Primær/Foreign Key til AppUser ========================
    [Key, ForeignKey("AppUser")] 
    [MaxLength(100)]
    public string UserId { get; set; } = null!;
    
    
    // ======================== Lokasjon ========================
    
    [Required]
    [MaxLength(2)]
    public string CountryCode { get; set; } = null!;
    
    [Required]
    [MaxLength(100)]
    public string Region { get; set; } = string.Empty;
    
    [MaxLength(100)]
    public string? City { get; set; }
    
    [MaxLength(25)]
    public string? PostalCode { get; set; }
    
    // ======================== Demografi ========================
    
    public DateTime DateOfBirth { get; set; }
    
    [EnumDataType(typeof(Gender))]
    public Gender Gender { get; set; }
    
    [NotMapped]
    public int? Age
    {
        get
        {
            var today = DateTime.Today;
            var age = today.Year - DateOfBirth.Year;
            // Justerer ned om brukeren ikke har hatt bursdag enda i år
            if (DateOfBirth.Date > today.AddYears(-age))
                age--;

            return age;
        }
    }
    
    
    // ======================== Innhold til profil ========================
    
    [MaxLength(1000)]
    public string? Bio { get; set; }
    
    [MaxLength(500)]
    public string? WebsitesCsv { get; set; }
    
    public List<string> Websites => WebsitesCsv?.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList() ?? [];

    public void SetWebsites(List<string> websites)
    {
        WebsitesCsv = string.Join(",", websites.Select(w => w.Trim()));
    }
    
    [EmailAddress]
    [MaxLength(100)]
    public string? ContactEmail { get; set; }
    
    [MaxLength(30)]
    public string? ContactPhone { get; set; }
    
    // ======================== Metadata ========================
    
    public DateTime? UpdatedAt { get; set; }
    
    
    // ======================== Navigasjonsegenskaper ========================
    
    public AppUser? AppUser { get; set; } = null!;
    
}
