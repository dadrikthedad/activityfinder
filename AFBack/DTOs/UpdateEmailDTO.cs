using System.ComponentModel.DataAnnotations;

namespace AFBack.DTOs;
public class UpdateEmailDTO
{
    private string _newEmail = null!;

    [Required(ErrorMessage = "Valid email is required.")]
    [EmailAddress(ErrorMessage = "Invalid email format.")]
    [MaxLength(100, ErrorMessage = "Email can't be more than 100 characters.")]
    public string NewEmail
    {
        get => _newEmail;
        set => _newEmail = value.Trim();
    }
    
    [Required(ErrorMessage = "Current password is required.")]
    public string CurrentPassword { get; set; } = null!;
}