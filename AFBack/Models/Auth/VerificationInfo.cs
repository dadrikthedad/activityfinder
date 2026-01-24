using System.ComponentModel.DataAnnotations;

namespace AFBack.Models.Auth;

public class VerificationInfo
{
    // ======================== Primærnøkkel ========================
    [Key]
    [MaxLength(100)]
    public string UserId { get; set; } = null!;
    
    // ======================== Password ========================
    [MaxLength(255)]
    public string? PasswordResetToken { get; set; }
    
    [MaxLength(8)]
    public string? PasswordResetCode { get; set; }
    public DateTime? PasswordResetTokenExpires { get; set; }
    
    // ======================== Email Confirmation ========================
    
    [MaxLength(8)]
    public string? EmailConfirmationCode { get; set; }
    
    [MaxLength(255)]
    public string? EmailConfirmationToken { get; set; }
    public DateTime? LastVerificationEmailSent { get; set; }
    
    public DateTime? EmailConfirmationTokenExpires { get; set; }
    
    // ======================== Navigasjonsegenskaper ========================
    public AppUser AppUser { get; set; } = null!; // Navigation property
}
