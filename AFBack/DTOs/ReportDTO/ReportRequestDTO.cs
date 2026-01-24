using System.ComponentModel.DataAnnotations;
using AFBack.Constants;
using AFBack.Models.Enums;

namespace AFBack.Models;

public class ReportRequestDTO
{
    [Required]
    public ReportTypeEnum Type { get; set; }

    [Required]
    [StringLength(200)]
    public string Title { get; set; }

    [Required]
    [StringLength(5000)]
    public string Description { get; set; }

    // For appUser reports - ID på bruker som rapporteres
    public string? ReportedUserId { get; set; }

    // For bug reports - steps to reproduce
    public string? StepsToReproduce { get; set; }

    // Expected vs actual behavior
    public string? ExpectedBehavior { get; set; }
    public string? ActualBehavior { get; set; }

    // Browser/device info for bug reports
    public string? UserAgent { get; set; }
    public string? BrowserVersion { get; set; }
    public string? DeviceInfo { get; set; }

    // Priority level
    public PriorityEnum Priority { get; set; } = PriorityEnum.Medium;

}
