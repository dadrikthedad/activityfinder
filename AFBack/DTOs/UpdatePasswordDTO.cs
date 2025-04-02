using System.ComponentModel.DataAnnotations;

namespace AFBack.DTOs
{
    public class UpdatePasswordDTO
    {
        [Required(ErrorMessage = "Current password is required.")]
        public string CurrentPassword { get; set; } = null!;

        [Required(ErrorMessage = "New password is required.")]
        [MinLength(8, ErrorMessage = "Password must be at least 8 characters long.")]
        [MaxLength(128, ErrorMessage = "Password must be maximum 128 characters long.")]
        [RegularExpression(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$",
            ErrorMessage = "Password must contain at least one lowercase letter, one uppercase letter and one number.")]
        public string NewPassword { get; set; } = null!;

        [Required(ErrorMessage = "Confirmation password is required.")]
        [Compare("NewPassword", ErrorMessage = "Password confirmation does not match.")]
        public string ConfirmNewPassword { get; set; } = null!;
    }
}