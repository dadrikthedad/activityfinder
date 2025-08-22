using System.ComponentModel.DataAnnotations;

namespace AFBack.DTOs.Email;

public class ResendVerificationRequest
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = null!;
}