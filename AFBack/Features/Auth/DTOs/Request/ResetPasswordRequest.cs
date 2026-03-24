using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.Auth.DTOs.Request;

/// <summary>
/// Steg 4: Bruker sender inn nytt passord.
/// SMS-koden ble allerede validert i steg 3 (verify-password-reset-sms).
/// </summary>
public class ResetPasswordRequest
{
    [Required(ErrorMessage = "Email is required")]
    [EmailAddress(ErrorMessage = "Email must be a valid format")]
    [MaxLength(256, ErrorMessage = "Email cannot exceed 256 characters")]
    public required string Email { get; init; }
    
    [Required(ErrorMessage = "New password is required")]
    [MinLength(8, ErrorMessage = "Password must be at least 8 characters")]
    public required string NewPassword { get; init; }
}
