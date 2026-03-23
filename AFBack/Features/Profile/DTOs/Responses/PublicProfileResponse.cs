namespace AFBack.Features.Profile.DTOs.Responses;

public class PublicProfileResponse
{
    // Fra AppUser (via cache)
    public string Id { get; set; } = null!;
    public string FullName { get; set; } = null!;
    public string? ProfileImageUrl { get; set; }

    public bool IsPrivate;

    // Lokasjon
    public string? CountryCode { get; set; }

    // Demografi (styrt av ShowAge/ShowBirthday)
    public int? Age { get; set; }
    public DateOnly? DateOfBirth { get; set; }

    // Profilinnhold (styrt av settings)
    public string? Bio { get; set; }
    public List<string>? Websites { get; set; }
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
}
