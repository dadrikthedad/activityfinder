namespace AFBack.Features.Searching.DTOs.Responses;

public class UserSearchResult
{
    public string Id { get; set; } = null!;
    public string FullName { get; set; } = null!;
    public string? ProfileImageUrl { get; set; }
    public string? City { get; set; }
    public string? Region { get; set; }
    public string CountryCode { get; set; } = null!;
    public int ProximityLevel { get; set; } // 0=PostalCode, 1=City, 2=Region, 3=Country, 4=Other
}
