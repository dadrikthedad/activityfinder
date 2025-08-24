using System.ComponentModel.DataAnnotations;

namespace AFBack.DTOs.Email;

public class ResetPasswordRequest
{
    [Required(ErrorMessage = "Token or code is required.")]
    public string TokenOrCode { get; set; } = string.Empty;
    
    [Required(ErrorMessage = "Password is required.")]
    [MinLength(8, ErrorMessage = "Password must be at least 8 character long.")]
    [MaxLength(128, ErrorMessage = "Password must be maximum 128 characters long.")]
    [RegularExpression(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$",
        ErrorMessage = "Password must contain at least one lowercase letter, uppercase letter and one number.")]
    public string NewPassword { get; set; } = null!;
    
    [Required(ErrorMessage = "Confirmed password is required.")]
    [MinLength(8, ErrorMessage = "Password must be at least 8 character long.")]
    [MaxLength(128, ErrorMessage = "Password must be maximum 128 characters long.")]
    [RegularExpression(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$",
        ErrorMessage = "Password must contain at least one lowercase letter, uppercase letter and one number.")]
    [Compare("NewPassword", ErrorMessage = "Password doesn't match.")]
    public string ConfirmPassword { get; set; } = null!;
}