namespace AFBack.Features.Profile.DTOs.Responses;

public class MyProfileResponse
{
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
