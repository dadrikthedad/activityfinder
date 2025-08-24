using System.ComponentModel.DataAnnotations;

namespace AFBack.Models;

public class VerificationInfo
{
    [Key]
    public int UserId { get; set; } // Primary key OG foreign key
    public User User { get; set; } = null!; // Navigation property
    
    [MaxLength(255)]
    public string? PasswordResetToken { get; set; }
    
    [MaxLength(8)]
    public string? PasswordResetCode { get; set; }
    public DateTime? PasswordResetTokenExpires { get; set; }
    
    
    public string? EmailConfirmationToken { get; set; }
    public DateTime? LastVerificationEmailSent { get; set; }
    public string? EmailConfirmationCode { get; set; }
    public DateTime? EmailConfirmationTokenExpires { get; set; }
}