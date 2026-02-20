using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.Auth.DTOs.Request;

/// <summary>
/// Steg 4: Bruker sender inn SMS-koden og nytt passord
/// </summary>
public class ResetPasswordRequest
{
    [Required(ErrorMessage = "Email is required")]
    [EmailAddress(ErrorMessage = "Email must be a valid format")]
    [MaxLength(256, ErrorMessage = "Email cannot exceed 256 characters")]
    public required string Email { get; init; }
    
    /// <summary>
    /// 6-sifret SMS-kode (ikke epost-kode — den ble validert i steg 2)
    /// </summary>
    [Required(ErrorMessage = "SMS code is required")]
    [StringLength(6, MinimumLength = 6, ErrorMessage = "Code must be exactly 6 digits")]
    [RegularExpression(@"^\d{6}$", ErrorMessage = "Code must be exactly 6 digits")]
    public required string Code { get; init; }
    
    [Required(ErrorMessage = "New password is required")]
    [MinLength(8, ErrorMessage = "Password must be at least 8 characters")]
    public required string NewPassword { get; init; }
}
