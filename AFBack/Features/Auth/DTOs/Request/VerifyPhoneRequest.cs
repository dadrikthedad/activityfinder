using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.Auth.DTOs.Request;

public class VerifyPhoneRequest
{
    [Required(ErrorMessage = "Phone number is required")]
    [Phone(ErrorMessage = "Phone number must be a valid format")]
    [MaxLength(20, ErrorMessage = "Phone number cannot exceed 20 characters")]
    public required string PhoneNumber { get; init; }
    
    [Required(ErrorMessage = "Verification code is required")]
    [StringLength(6, MinimumLength = 6, ErrorMessage = "Code must be exactly 6 digits")]
    [RegularExpression(@"^\d{6}$", ErrorMessage = "Code must be exactly 6 digits")]
    public required string Code { get; init; }
}
