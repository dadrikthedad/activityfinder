using System.ComponentModel.DataAnnotations;

namespace AFBack.DTOs.Email;

public class ResetPasswordRequest
{
    [Required]
    public string Token { get; set; } = null!;
    
    [Required]
    [MinLength(8, ErrorMessage = "Passordet må være minst 8 tegn")]
    public string NewPassword { get; set; } = null!;
    
    [Required]
    [Compare("NewPassword", ErrorMessage = "Passordene må være like")]
    public string ConfirmPassword { get; set; } = null!;
}