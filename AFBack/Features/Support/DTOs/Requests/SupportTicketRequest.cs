using System.ComponentModel.DataAnnotations;
using AFBack.Features.Support.Enums;

namespace AFBack.Features.Support.DTOs.Requests;

public class SupportTicketRequest
{
    [Required(ErrorMessage = "Email is required")]
    [EmailAddress(ErrorMessage = "Invalid email")]
    [MaxLength(255)]
    public string Email { get; init => field = value.Trim().ToLowerInvariant(); } = string.Empty;

    [Required(ErrorMessage = "SupportTicketType is required")]
    public SupportTicketType Type { get; set; }

    [Required(ErrorMessage = "Title is required")]
    [MaxLength(100)]
    public string Title { get; init => field = value.Trim(); } = string.Empty;

    [Required(ErrorMessage = "Description is required")]
    [StringLength(2000, MinimumLength = 10)]
    public string Description { get; init => field = value.Trim(); } = string.Empty;

    // Bug report-spesifikke (nullable — kun relevant når Type == Bug)
    [MaxLength(2000)]
    public string? StepsToReproduce { get; init => field = value?.Trim(); }

    [MaxLength(1000)]
    public string? ExpectedBehavior { get; init => field = value?.Trim(); }

    [MaxLength(1000)]
    public string? ActualBehavior { get; init => field = value?.Trim(); }
}

