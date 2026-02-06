using System.ComponentModel.DataAnnotations;
using AFBack.Infrastructure.Security.Models;

namespace AFBack.Features.Auth.Models;

public class LoginHistory
{
    // ======================== Primærnøkkel ========================
    public int Id { get; set; }
    
    // ======================== Foreign keys ========================
    
    [Required, MaxLength(100)]
    public string UserId { get; set; } = null!;
    public int UserDeviceId { get; set; }
    public int? SuspiciousActivityId { get; set; }
    
    // ======================== Metadata ========================
    public DateTime LoginAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? LogoutAt { get; set; }
    
    [Required, MaxLength(45)]
    public string IpAddress { get; set; } = null!;
    
    [MaxLength(500)]
    public string? UserAgent { get; set; }
    
    // ======================== Location ========================
    
    // Lokasjon basert på IP (kan være forskjellig fra device sin siste lokasjon)
    [MaxLength(100)]
    public string? City { get; set; }
    
    [MaxLength(100)]
    public string? Region { get; set; }
    
    [MaxLength(100)]
    public string? Country { get; set; }
    
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    
    // ======================== Sikkerhet ========================
    public bool WasSuspicious { get; set; } = false;
    
    [MaxLength(500)]
    public string? SuspiciousReason { get; set; }
    
    public bool RequiredTwoFactor { get; set; } = false;
    
    // ======================== Navigasjonsegenskaper ========================
    public AppUser AppUser { get; set; } = null!;

    public UserDevice UserDevice { get; set; } = null!;
    
    public SuspiciousActivity? SuspiciousActivity { get; set; }
}
