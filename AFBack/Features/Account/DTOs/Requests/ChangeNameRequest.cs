using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.Account.DTOs.Requests;

public class ChangeNameRequest
{
    [Required(ErrorMessage = "First name is required")]
    [MaxLength(100, ErrorMessage = "First name cannot exceed 100 characters")]
    public required string FirstName { get; init => field = value.Trim(); }

    [Required(ErrorMessage = "Last name is required")]
    [MaxLength(100, ErrorMessage = "Last name cannot exceed 100 characters")]
    public required string LastName { get; init => field = value.Trim(); }
}
