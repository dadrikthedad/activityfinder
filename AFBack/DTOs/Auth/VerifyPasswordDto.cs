using System.ComponentModel.DataAnnotations;

namespace AFBack.DTOs.Auth;

public class VerifyPasswordDto
{
    [Required(ErrorMessage = "Password is required.")]
    public string Password { get; set;  }
}