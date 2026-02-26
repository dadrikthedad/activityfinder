using System.ComponentModel.DataAnnotations;
using AFBack.Features.Auth.Models;
using AFBack.Features.Support.Enums;

namespace AFBack.Features.Support.Models;

public class UserReport
{
     // ======================== Primary Key ========================
    public int Id { get; set; }
    
    // ======================== Relaterte brukere ========================
    [MaxLength(100, ErrorMessage = "ReportedUserId cannot be more than 100 characters")]
    public string ReportedUserId { get; set; } = string.Empty;
    
    [MaxLength(100, ErrorMessage = "SubmittedByUserId cannot be more than 100 characters")]
    public string SubmittedByUserId { get; set; } = string.Empty;
    
    // ======================== Support Ticket egenskaper ========================
    [Required(ErrorMessage = "Description is required")]
    [MinLength(10, ErrorMessage = "Description must be at least 10 characters")]
    [MaxLength(2000, ErrorMessage = "Description cannot be more than 2000 characters")]
    public string Description { get; set; } = string.Empty;
    
    // ======================== UserReport-relaterte egenskaper ========================
    public UserReportReason UserReportReason { get; set; }
    
    // ======================== TimeStamps ========================
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
  
    public DateTime? UpdatedAt { get; set; }
  
    public DateTime? ResolvedAt { get; set; }
  
    public DateTime? ClosedAt { get; set; }
    
    // ======================== Support staff egenskaper ========================
    
    public UserReportReason Reason { get; set; }
  
    public UserReportStatus Status { get; set; } = UserReportStatus.Pending;
    public Priority Priority { get; set; } = Priority.Normal;
  
    // For interne notater fra support team
    [MaxLength(5000, ErrorMessage = "Internal notes cannot be more than 5000 characters")]
    public string? InternalNotes { get; set; }
  
    // Svar til brukeren fra support team
    [MaxLength(5000, ErrorMessage = "Response cannot be more than 5000 characters")]
    public string? Response { get; set; }
    
    // ======================== Navigasjonsegenskaper ========================
    
    public AppUser? SubmittedByUser { get; set; }
    public AppUser? ReportedUser { get; set; }
    public List<UserReportAttachment> Attachments { get; set; } = new();
}
