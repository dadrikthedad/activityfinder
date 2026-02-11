using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AFBack.Constants;
using AFBack.Features.Auth.Models;

namespace AFBack.Infrastructure.Security.Models;
// Nivå 1: Enkel sporing (alltid tilgjengelig)
//  Nivå 2: Device sporing (kun hvis fingerprint er tilgjengelig)
// Nivå 3: Bruker sporing (kun hvis innlogget)
// Fallback: Lagre raw AppUser-Agent hvis vi ikke har device
public class IpBan : IValidatableObject
{
    // ======================== Primærnøkkel ========================
    public int Id { get; set; }
    
    // ======================== Foreign Keys ========================
    
    [MaxLength(100)]
    public string? BannedByUserId { get; set; } // Null = systemban
    
    [MaxLength(100)]
    public string? UnbannedByUserId { get; set; }
    
    // ======================== Metadata ========================
    
    [MaxLength(45)]
    public string? IpAddress { get; set; }
    
    [EnumDataType(typeof(BanType))]
    public BanType BanType { get; set; }
    
    [Required, MaxLength(1000)]
    public string Reason { get; set; } = string.Empty;
    
    public DateTime BannedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? ExpiresAt { get; set; }
    
    public bool IsActive { get; set; } = true;
    
    [MaxLength(500)]
    public string? Notes { get; set; }
    
    public DateTime? UnbannedAt { get; set; }
    
    // ======================== Navigasjonsegenskaper ========================
    
    [ForeignKey(nameof(BannedByUserId))]
    public AppUser? BannedByUser { get; set; }
    
    [ForeignKey(nameof(UnbannedByUserId))]
    public AppUser? UnbannedByUser { get; set; }
    
    // ======================== Validation ========================
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (ExpiresAt.HasValue && ExpiresAt.Value <= BannedAt)
            yield return new ValidationResult("ExpiresAt must be after BannedAt",
                [nameof(ExpiresAt)]);
    }
    
    // ======================== Heklper methods ========================
    
    /// <summary>
    /// Sjekker om banen er utløpt
    /// </summary>
    public bool IsExpired => BanType == BanType.Temporary && ExpiresAt.HasValue && DateTime.UtcNow > ExpiresAt;
    
}
