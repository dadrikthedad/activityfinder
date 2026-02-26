using System.ComponentModel.DataAnnotations;
using AFBack.Features.Auth.Models;
using AFBack.Features.Support.Enums;

namespace AFBack.Features.Support.Models;

public class SupportTicket
{
    // ======================== Primary Key ========================
    public int Id { get; set; }
    
    // ======================== Relaterte brukere ========================
    
    [MaxLength(100, ErrorMessage = "SubmittedByUserId cannot be more than 100 characters")]
    public string? SubmittedByUserId { get; set; }
    
    // ======================== Support Ticket egenskaper ========================
  
    [Required(ErrorMessage = "Email is required")]
    [EmailAddress(ErrorMessage = "Invalid email address")]
    [MaxLength(255, ErrorMessage = "Email cannot be more than 255 characters")]
    public string Email { get; set; } = string.Empty;
    
    [Required(ErrorMessage = "SupportTicketType is required")]
    public SupportTicketType Type { get; set; }
  
    [Required(ErrorMessage = "Title is required")]
    [MaxLength(100, ErrorMessage = "Title cannot be more than 100 characters")]
    public string Title { get; set; } = string.Empty;
  
    [Required(ErrorMessage = "Description is required")]
    [MinLength(10, ErrorMessage = "Description must be at least 10 characters")]
    [MaxLength(2000, ErrorMessage = "Description cannot be more than 2000 characters")]
    public string Description { get; set; } = string.Empty;
    
    // ======================== Bug Report relaterte felter ========================
    
    [MaxLength(2000, ErrorMessage = "Steps to produce cannot be more than 2000 characters")]
    public string? StepsToReproduce { get; set; }

    [MaxLength(1000, ErrorMessage = "ExpectedBehavior cannot be more than 1000 characters")]
    public string? ExpectedBehavior { get; set; }

    [MaxLength(1000, ErrorMessage = "ActualBehavior cannot be more than 1000 characters")]
    public string? ActualBehavior { get; set; }
    
    // ======================== TimeStamps ========================
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
  
    public DateTime? UpdatedAt { get; set; }
  
    public DateTime? ResolvedAt { get; set; }
  
    public DateTime? ClosedAt { get; set; }
    
    // ======================== Support staff egenskaper ========================
  
    public SupportTicketStatus Status { get; set; } = SupportTicketStatus.New;
  
    public Priority Priority { get; set; } = Priority.Normal;
  
    // For interne notater fra support team
    [MaxLength(5000, ErrorMessage = "Internal notes cannot be more than 5000 characters")]
    public string? InternalNotes { get; set; }
  
    // Svar til brukeren fra support team
    [MaxLength(5000, ErrorMessage = "Response cannot be more than 5000 characters")]
    public string? Response { get; set; }
    
    // ======================== Logging for missbruk ========================
    [MaxLength(45, ErrorMessage = "IPAddress cannot be more than 25 characters")]
    public string IpAddress { get; set; } = string.Empty;
    [MaxLength(500, ErrorMessage = "UserAgent cannot be more than 500 characters")]
    public string? UserAgent { get; set; }

    
    
    // ======================== Navigasjonsegenskaper ========================
    
    public AppUser? SubmittedByUser { get; set; }
    public List<SupportAttachment> Attachments { get; set; } = new();
}
