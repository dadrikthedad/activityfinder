using AFBack.Common.DTOs;
using AFBack.Models.Enums;

namespace AFBack.Features.Profile.DTOs.Responses;

public class PublicProfileResponse
{
    // Fra AppUser (via cache)
    public string Id { get; set; } = null!;
    public string FullName { get; set; } = null!;
    public string? ProfileImageUrl { get; set; }

    public bool IsPrivate;

    // Lokasjon (Region vises alltid, PostalCode styres av settings)
    public string? CountryCode { get; set; }
    public string? Region { get; set; }
    public string? City { get; set; }
    public string? PostalCode { get; set; }

    // Demografi (styrt av ShowAge/ShowGender/ShowBirthday)
    public int? Age { get; set; }
    public DateTime? DateOfBirth { get; set; }
    public Gender? Gender { get; set; }

    // Profilinnhold (styrt av settings)
    public string? Bio { get; set; }
    public List<string>? Websites { get; set; }
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
    
    // Venner
    public List<UserSummaryDto>? Friends { get; set; }
    public int? FriendCount { get; set; }
    
}
