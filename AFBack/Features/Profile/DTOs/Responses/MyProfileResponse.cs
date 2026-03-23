namespace AFBack.Features.Profile.DTOs.Responses;

public class MyProfileResponse
{
    // Fra AppUser (via cache)
    public string Id { get; set; } = null!;
    public string FullName { get; set; } = null!;
    public string? ProfileImageUrl { get; set; }

    // Lokasjon
    public string CountryCode { get; set; } = null!;
    
    // Demografi
    public DateOnly DateOfBirth { get; set; }
    public int? Age { get; set; }

    // Profilinnhold
    public string? Bio { get; set; }
    public List<string> Websites { get; set; } = [];
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }

    public DateTime? UpdatedAt { get; set; }
}
