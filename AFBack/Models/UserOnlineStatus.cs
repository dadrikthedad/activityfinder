using System.ComponentModel.DataAnnotations;

namespace AFBack.Models;

public class UserOnlineStatus
{
    [Key]
    public int Id { get; set; }
    
    [Required]
    public int UserId { get; set; }
    
    [Required]
    [MaxLength(100)]
    public string DeviceId { get; set; }
    
    [Required]
    public DateTime LastSeen { get; set; }
    
    public DateTime? LastBootstrapAt { get; set; }
    
    [MaxLength(20)]
    public string Platform { get; set; } // 'web' or 'mobile'
    
    public bool IsOnline { get; set; }
    
    // Egenskaper tilhørende forskjellige kleinter om de kan 
    public string[] Capabilities { get; set; } = Array.Empty<string>();
    
    // Navigation property
    public virtual User User { get; set; }
}
