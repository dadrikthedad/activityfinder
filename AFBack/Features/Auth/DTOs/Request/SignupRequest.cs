using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.Auth.DTOs.Request;

public class SignupRequest
{
    [Required(ErrorMessage = "Email is required")]
    [EmailAddress(ErrorMessage = "Email must be a valid format")]
    [MaxLength(256, ErrorMessage = "Email cannot exceed 256 characters")]
    public string Email { get; init; } = null!;
    
    [Required(ErrorMessage = "Password is required")]
    [MinLength(8, ErrorMessage = "Password must be at least 8 characters")]
    [MaxLength(128, ErrorMessage = "Password cannot exceed 128 characters")]
    public string Password { get; init; } = null!;
    
    [Required(ErrorMessage = "First name is required")]
    [MaxLength(75, ErrorMessage = "First name cannot exceed 75 characters")]
    public string FirstName { get; init; } = null!;
    
    [Required(ErrorMessage = "Last name is required")]
    [MaxLength(75, ErrorMessage = "Last name cannot exceed 75 characters")]
    public string LastName { get; init; } = null!;
    
    [Phone(ErrorMessage = "Phone number must be a valid format")]
    [MaxLength(30, ErrorMessage = "Phone number cannot exceed 30 characters")]
    public string? PhoneNumber { get; init; }
}
