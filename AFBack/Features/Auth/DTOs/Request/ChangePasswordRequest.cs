using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.Auth.DTOs.Request;

/// <summary>
/// Request for å bytte passord for innlogget bruker.
/// Krever gammelt passord for å bekrefte identitet.
/// </summary>
public class ChangePasswordRequest
{
    [Required(ErrorMessage = "Current password is required")]
    public required string CurrentPassword { get; init; }
    
    [Required(ErrorMessage = "New password is required")]
    [MinLength(8, ErrorMessage = "Password must be at least 8 characters")]
    public required string NewPassword { get; init; }
    
    [Required(ErrorMessage = "Confirm password is required")]
    [Compare(nameof(NewPassword), ErrorMessage = "Passwords do not match")]
    public required string ConfirmNewPassword { get; init; }
}
