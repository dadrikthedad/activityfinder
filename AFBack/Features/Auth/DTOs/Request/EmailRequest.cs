using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.Auth.DTOs.Request;

public class EmailRequest
{
    [Required(ErrorMessage = "Email is required")]
    [EmailAddress(ErrorMessage = "Email must be a valid format")]
    [MaxLength(256, ErrorMessage = "Email cannot exceed 256 characters")]
    public string Email { get; init => field = value.Trim(); } = null!;
}
