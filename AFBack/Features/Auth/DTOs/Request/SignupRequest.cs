using System.ComponentModel.DataAnnotations;
using AFBack.Common.Validations;
using AFBack.Features.Profile.Enums;

namespace AFBack.Features.Auth.DTOs.Request;

public class SignupRequest
{
    [Required(ErrorMessage = "Email is required")]
    [EmailAddress(ErrorMessage = "Email must be a valid format")]
    [MaxLength(256, ErrorMessage = "Email cannot exceed 256 characters")]
    public string Email { get; init => field = value.Trim(); } = null!;
    
    [Required(ErrorMessage = "Password is required")]
    [MinLength(8, ErrorMessage = "Password must be at least 8 characters")]
    [MaxLength(128, ErrorMessage = "Password cannot exceed 128 characters")]
    public string Password { get; init; } = null!;
    
    [Required(ErrorMessage = "First name is required")]
    [MaxLength(75, ErrorMessage = "First name cannot exceed 75 characters")]
    public string FirstName { get; init => field = value.Trim(); } = null!;
    
    [Required(ErrorMessage = "Last name is required")]
    [MaxLength(75, ErrorMessage = "Last name cannot exceed 75 characters")]
    public string LastName { get; init => field = value.Trim(); } = null!;

    [Required(ErrorMessage = "PhoneNumber is required")]
    [Phone(ErrorMessage = "Phone number must be a valid format")]
    [MaxLength(30, ErrorMessage = "Phone number cannot exceed 30 characters")]
    public string PhoneNumber { get; init => field = value.Trim(); } = null!;

    // ======================== Demografi ========================
    
    [Required(ErrorMessage = "Date of birth is required")]
    [NotInFuture(minimumAge: 18, maximumAge: 125, ErrorMessage = "Age must be between 18 and 125 years old")]
    public DateTime DateOfBirth { get; init; }
    
    [Required(ErrorMessage = "Gender is required")]
    [EnumDataType(typeof(Gender), ErrorMessage = "Gender must be a valid value")]
    public Gender Gender { get; init; }
    
    // ======================== Lokasjon ========================

    [Required(ErrorMessage = "Country code is required")]
    [MaxLength(2, ErrorMessage = "Country code must be a valid ISO 3166-1 alpha-2 code")]
    public string CountryCode { get; init => field = value.Trim().ToUpper(); } = null!;


    [Required(ErrorMessage = "Region is required")]
    [MaxLength(100, ErrorMessage = "Region cannot exceed 100 characters")]
    public string Region { get; init; } = null!;
    
    [MaxLength(100, ErrorMessage = "City name can't be more than 100 characters.")]
    public string? City { get; init => field = value?.Trim(); }

    [MaxLength(25, ErrorMessage = "Postal code cannot exceed 25 characters")]
    public string? PostalCode { get; init => field = value?.Trim(); }
    
}
