using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.Auth.DTOs.Request;

public class ResetPasswordRequest
{
    [Required(ErrorMessage = "Email is required")]
    [EmailAddress(ErrorMessage = "Email must be a valid format")]
    [MaxLength(256, ErrorMessage = "Email cannot exceed 256 characters")]
    public required string Email { get; init; }
    
    [Required]
    [StringLength(6, MinimumLength = 6)]
    public required string Code { get; init; }
    
    [Required]
    [MinLength(8)]
    public required string NewPassword { get; init; }
}
