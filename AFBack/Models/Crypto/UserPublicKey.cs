using System.ComponentModel.DataAnnotations;

namespace AFBack.Models.Crypto;

public class UserPublicKey
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; }
        
    [Required]
    public string PublicKey { get; set; } = string.Empty;
        
    public int KeyVersion { get; set; } = 1;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;
}