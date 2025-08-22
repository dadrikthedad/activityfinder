using System.ComponentModel.DataAnnotations;

namespace AFBack.DTOs.Email;

public class ForgotPasswordRequest
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = null!;
}