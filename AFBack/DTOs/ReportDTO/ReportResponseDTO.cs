using AFBack.Constants;

namespace AFBack.Models;

public class ReportResponseDTO
{
    public Guid Id { get; set; }
    public ReportTypeEnum Type { get; set; }
    public string Title { get; set; }
    public string Description { get; set; }
    public DateTime SubmittedAt { get; set; }
    public ReportStatusEnum Status { get; set; }
    public PriorityEnum Priority { get; set; }
    public string? ReportedUserId { get; set; }
    public string? StepsToReproduce { get; set; }
    public string? ExpectedBehavior { get; set; }
    public string? ActualBehavior { get; set; }
    public string? UserAgent { get; set; }
    public string? BrowserVersion { get; set; }
    public string? DeviceInfo { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? AssignedTo { get; set; }
    public string? Resolution { get; set; }
    public List<string>? Attachments { get; set; }
}