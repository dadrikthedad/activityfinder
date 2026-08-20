using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.Auth.DTOs.Request;

public class VerifyPasswordRequest
{
    [Required(ErrorMessage = "Current password is required")]
    public required string Password { get; init; }
}
