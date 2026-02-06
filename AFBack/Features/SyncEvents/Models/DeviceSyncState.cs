using System.ComponentModel.DataAnnotations;
using AFBack.Features.Auth.Models;

namespace AFBack.Features.SyncEvents.Models;

public class DeviceSyncState
{
    // ======================== Primærnøkkel ========================
    [Required]
    public int UserDeviceId { get; set; }
    
    // ======================== Sync data ========================
    
    // Siste gang denne enheten ble synket
    public DateTime LastSyncAt { get; set; } = DateTime.UtcNow;
    
    // Gjør det samme som LastSyncAt men AI anbefaler å ha denne uansett, vi finner ut det
    public DateTime? LastSyncedEventTime { get; set; }
    
    // ======================== Metoder ========================
    
    // Henter ut sist gang vi syncet enheten
    public TimeSpan TimeSinceLastSync => DateTime.UtcNow - LastSyncAt;
    
    // Sjekker om enheten trenger full refresh hvis det er lenge siden siste sync
    public bool RequiresFullRefresh(TimeSpan inactivityThreshold) => TimeSinceLastSync > inactivityThreshold;
    
    // ======================== Navigasjonsegenskaper ========================
    public UserDevice UserDevice { get; set; } = null!;
}
