namespace AFBack.Features.Searching.DTOs.Responses;

public class UserSearchResult
{
    public string Id { get; set; } = null!;
    public string FullName { get; set; } = null!;
    public string? ProfileImageUrl { get; set; }
    public string? CountryCode { get; set; }
    
    // ProximityLevel må være int for at EfCore skal slippe å oversette enum til ternary
    public int ProximityLevel { get; set; } // 3=Country, 4=Other
}
