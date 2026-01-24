using System.ComponentModel.DataAnnotations;

namespace AFBack.Models.Auth;


public class RefreshToken
{
    // ======================== Primærnøkkel ========================
    public int Id { get; set; }
    
    // ======================== Foreign Keys ========================
    [Required, MaxLength(100)] // 
    public string UserId { get; set; } = null!;
    public int UserDeviceId { get; set; }
    
    // ======================== Metadata ========================
    
    [Required, MaxLength(500)]
    public string Token { get; set; } = string.Empty;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    
    
    // ======================== Revoking ========================
    
    public bool IsRevoked { get; set; }
    public DateTime? RevokedAt { get; set; }
    
    [MaxLength(200)]
    public string? RevokedReason { get; set; } // "AppUser logout", "Security breach", etc.

    [MaxLength(45)] 
    public string IpAddress { get; set; } = string.Empty;
    
    [MaxLength(500)]
    public string? UserAgent { get; set; }
    
    // ======================== Navigasjonsegenskaper ========================
    public AppUser AppUser { get; set; } = null!;
    public UserDevice UserDevice { get; set; } = null!;
}
