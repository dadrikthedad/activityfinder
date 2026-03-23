namespace AFBack.Features.Bootstrap.DTOs.Responses;

public class UserProfileResponse
{
    // Lokasjon
    public required string CountryCode { get; init; }
    
    // Demografi
    public DateOnly DateOfBirth { get; init; }
    public int? Age { get; init; }
    
    // Profilinnhold
    public string? Bio { get; init; }
    public List<string> Websites { get; init; } = [];
    public string? ContactEmail { get; init; }
    public string? ContactPhone { get; init; }
}
