using System.ComponentModel.DataAnnotations;
using AFBack.Features.Auth.Models;
using AFBack.Infrastructure.Security.Enums;

namespace AFBack.Infrastructure.Security.Models;

// Nivå 1: Enkel sporing (alltid tilgjengelig)
// Nivå 2: Device sporing (kun hvis fingerprint er tilgjengelig)
// Nivå 3: Bruker sporing (kun hvis innlogget)

public class SuspiciousActivity
{
    // ======================== Primærnøkkel ========================
    public int Id { get; set; }
    
    // ======================== Foreign Keys ========================
    [MaxLength(100)]
    public string? UserId { get; set; }
    public int? UserDeviceId { get; set; }
    
    // ======================== Metadata ========================
    
    [Required, MaxLength(45)]
    public string IpAddress { get; set; } = string.Empty;
    
    [MaxLength(500)]
    public string? UserAgent { get; set; }

    [EnumDataType(typeof(SuspiciousActivityType))]
    public SuspiciousActivityType ActivityType { get; set; }
    
    [Required, MaxLength(500)]
    public string Reason { get; set; } = string.Empty;
    
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    
    [MaxLength(200)]
    public string? Endpoint { get; set; }
    
    // ======================== Navigasjonsegenskaper ========================
    public AppUser? User { get; set; }
    public UserDevice? UserDevice { get; set; }
}
