using System.ComponentModel.DataAnnotations;
using AFBack.Features.Auth.Models;
using AFBack.Features.SyncEvents.Enums;

namespace AFBack.Features.SyncEvents.Models;

public class SyncEvent
{
    // ======================== PRIMÆRNØKKEL ========================
    public int Id { get; set; }
    
    // ======================== Foreign keys ========================
    [Required]
    [MaxLength(100)]
    public string UserId { get; set; } = string.Empty;

    [Required] 
    [MaxLength(50)] 
    public SyncEventType EventType { get; set; }

    [Required]
    [MaxLength(10000)] 
    public string EventData { get; set; } = string.Empty;
    
    [Required]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // ======================== Metoder ========================
    // Hente alderen på eventen
    public TimeSpan Age => DateTime.UtcNow - CreatedAt;
    
    // Sjekk for å se om event er fra nylig
    public bool IsRecent => Age < TimeSpan.FromMinutes(5);
    // ======================== Navigasjonsegenskaper ========================
    public AppUser? User { get; set; }
}
