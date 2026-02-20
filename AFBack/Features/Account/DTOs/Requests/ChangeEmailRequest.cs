using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.Account.DTOs.Requests;

/// <summary>
/// Request for å starte epost-bytte. Krever passord for å bekrefte identitet.
/// </summary>
public class ChangeEmailRequest
{
    [Required(ErrorMessage = "Current password is required")]
    public required string CurrentPassword { get; init; }
    
    [Required(ErrorMessage = "New email is required")]
    [EmailAddress(ErrorMessage = "Email must be a valid format")]
    [MaxLength(256, ErrorMessage = "Email cannot exceed 256 characters")]
    public required string NewEmail { get; init; }
}
