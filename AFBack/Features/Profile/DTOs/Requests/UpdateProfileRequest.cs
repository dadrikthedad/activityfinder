using System.ComponentModel.DataAnnotations;
using AFBack.Common.Validations;

namespace AFBack.Features.Profile.DTOs.Requests;

public class UpdateProfileRequest
{
    // ======================== Lokasjon ========================

    [Required(ErrorMessage = "Country code is required")]
    [MaxLength(2, ErrorMessage = "Country code must be a valid ISO 3166-1 alpha-2 code")]
    public string CountryCode { get; init => field = value.Trim().ToUpper(); } = null!;

    // ======================== Demografi ========================

    [Required(ErrorMessage = "Date of birth is required")]
    [NotInFuture(minimumAge: 18, maximumAge: 125, ErrorMessage = "Age must be between 18 and 125 years old")]
    public DateOnly DateOfBirth { get; init; }
    
    // ======================== Profilinnhold ========================

    [MaxLength(1000, ErrorMessage = "Bio can't be more than 1000 characters")]
    public string? Bio { get; init => field = value?.Trim(); }

    [MaxLength(5, ErrorMessage = "Maximum 5 websites allowed")]
    public List<string>? Websites { get; init; }

    [EmailAddress(ErrorMessage = "Contact email must be a valid format")]
    [MaxLength(100, ErrorMessage = "Contact email can't be more than 100 characters")]
    public string? ContactEmail { get; init => field = value?.Trim(); }

    [Phone(ErrorMessage = "Contact phone must be a valid format")]
    [MaxLength(30, ErrorMessage = "Contact phone can't be more than 30 characters")]
    public string? ContactPhone { get; init => field = value?.Trim(); }
}
