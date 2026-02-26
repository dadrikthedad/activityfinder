using AFBack.Features.Profile.Enums;

namespace AFBack.Features.Bootstrap.DTOs.Responses;

public class UserProfileResponse
{
    // Lokasjon
    public required string CountryCode { get; init; }
    public required string Region { get; init; }
    public string? City { get; init; }
    public string? PostalCode { get; init; }
    
    // Demografi
    public DateTime DateOfBirth { get; init; }
    public Gender Gender { get; init; }
    public int? Age { get; init; }
    
    // Profilinnhold
    public string? Bio { get; init; }
    public List<string> Websites { get; init; } = [];
    public string? ContactEmail { get; init; }
    public string? ContactPhone { get; init; }
}
