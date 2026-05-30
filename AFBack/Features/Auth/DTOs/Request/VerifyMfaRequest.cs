using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.Auth.DTOs.Request;

public class VerifyMfaRequest
{
    [Required(ErrorMessage = "Email is required")]
    [EmailAddress(ErrorMessage = "Email must be a valid format")]
    [MaxLength(256, ErrorMessage = "Email cannot exceed 256 characters")]
    public string Email { get; init; } = null!;
    
    [Required(ErrorMessage = "Verification code is required")]
    [StringLength(6, MinimumLength = 6, ErrorMessage = "Code must be exactly 6 digits")]
    [RegularExpression(@"^\d{6}$", ErrorMessage = "Code must be exactly 6 digits")]
    public required string Code { get; init; }
    
    [Required(ErrorMessage = "Device info is required")]
    public required DeviceInfoRequest Device { get; init; }
}
