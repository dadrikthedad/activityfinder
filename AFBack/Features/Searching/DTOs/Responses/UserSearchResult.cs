namespace AFBack.Features.Searching.DTOs.Responses;

public class UserSearchResult
{
    public string Id { get; set; } = null!;
    public string FullName { get; set; } = null!;
    public string? ProfileImageUrl { get; set; }
    public string? City { get; set; }
    public string? Region { get; set; }
    public string CountryCode { get; set; } = null!;
    
    // ProximityLevel må være int for at EfCore skal slippe å oversette enum til ternary
    public int ProximityLevel { get; set; } // 0=PostalCode, 1=City, 2=Region, 3=Country, 4=Other
    
    public bool IsFriend { get; set; }
}
