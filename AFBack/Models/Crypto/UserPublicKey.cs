using System.ComponentModel.DataAnnotations;
using AFBack.Models.Auth;

namespace AFBack.Models.Crypto;

public class UserPublicKey
{
    // ======================== PRIMÆRNØKKEL ========================
    public int Id { get; set; }
    
    // ======================== Foreign Keys ========================
    [Required, MaxLength(100)]
    public string UserId { get; set; } = null!;
    
    // ======================== Encryption data ========================
    [Required]
    [MaxLength(1000)]
    public string PublicKey { get; set; } = string.Empty;
        
    public int KeyVersion { get; set; } = 1;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;
    
    // ======================== Navigasjonsegenskaper ========================
    public AppUser User { get; set; } = null!;
}
