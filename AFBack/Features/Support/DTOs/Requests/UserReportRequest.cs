using System.ComponentModel.DataAnnotations;
using AFBack.Features.Support.Enums;

namespace AFBack.Features.Support.DTOs.Requests;

public class UserReportRequest
{
    [Required(ErrorMessage = "ReportedUserId is required")]
    [MaxLength(100, ErrorMessage = "ReportedUserId cannot exceed 100 characters")]
    public string ReportedUserId { get; init => field = value.Trim(); } = string.Empty;

    [Required(ErrorMessage = "Report reason is required")]
    public UserReportReason Reason { get; set; }

    [Required(ErrorMessage = "Description is required")]
    [StringLength(2000, MinimumLength = 10, ErrorMessage = "Description must be between 10 and 2000 characters")]
    public string Description { get; init => field = value.Trim(); } = string.Empty;
}
