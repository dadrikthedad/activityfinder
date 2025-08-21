using System.ComponentModel.DataAnnotations;
using AFBack.Constants;

namespace AFBack.Models;

public class Report
{
    [Key]
    public Guid Id { get; set; }
    
    [Required]
    public ReportTypeEnum Type { get; set; }
    
    [Required]
    [StringLength(200)]
    public string Title { get; set; }
    
    [Required]
    [StringLength(5000)]
    public string Description { get; set; }
    
    // Hvem som sendte rapporten (kan være null for anonymous)
    public int? SubmittedByUserId { get; set; }
    
    [Required]
    public DateTime SubmittedAt { get; set; }
    
    // For user reports - ID på bruker som rapporteres
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
    [Required]
    public PriorityEnum Priority { get; set; } = PriorityEnum.Medium;
    
    // Status tracking
    [Required]
    public ReportStatusEnum Status { get; set; } = ReportStatusEnum.Open;
    
    // Admin fields for tracking
    public DateTime? UpdatedAt { get; set; }
    public string? AssignedTo { get; set; } // Admin/support person assigned
    public string? Resolution { get; set; } // Resolution notes
    
    // Attachments - du kan lagre som JSON string eller lage egen tabell
    public string? AttachmentsJson { get; set; } // JSON serialized List<string>
    
    // Navigation properties hvis du bruker Entity Framework
    // public User? SubmittedByUser { get; set; }
    // public User? ReportedUser { get; set; }
}