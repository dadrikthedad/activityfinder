using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.Account.DTOs.Requests;

public class VerifyCodeRequest
{
    [Required(ErrorMessage = "Verification code is required")]
    [StringLength(6, MinimumLength = 6, ErrorMessage = "Code must be exactly 6 digits")]
    [RegularExpression(@"^\d{6}$", ErrorMessage = "Code must be exactly 6 digits")]
    public required string Code { get; init => field = value.Trim(); }
}
