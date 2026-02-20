using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.Account.DTOs.Requests;

/// <summary>
/// Request for å starte telefonnummer-bytte. Krever passord for å bekrefte identitet.
/// </summary>
public class ChangePhoneRequest
{
    [Required(ErrorMessage = "Current password is required")]
    public required string CurrentPassword { get; init; }
    
    [Required(ErrorMessage = "New phone number is required")]
    [Phone(ErrorMessage = "Phone number must be a valid format")]
    [MaxLength(20, ErrorMessage = "Phone number cannot exceed 20 characters")]
    public required string NewPhoneNumber { get; init; }
}
