using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.Auth.DTOs.Request;

public class ResendPhoneVerificationRequest
{
    [Required(ErrorMessage = "Phone number is required")]
    [Phone(ErrorMessage = "Phone number must be a valid format")]
    [MaxLength(20, ErrorMessage = "Phone number cannot exceed 20 characters")]
    public required string PhoneNumber { get; init; }
}
