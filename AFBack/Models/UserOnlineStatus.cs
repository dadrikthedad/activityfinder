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
    
    // WebSocket-relaterte egenskaper
    public bool IsOnline { get; set; }
    
    public bool IsWebSocketConnected { get; set; } // Spesifikt for WebSocket-tilkobling
    
    [MaxLength(200)]
    public string? ConnectionId { get; set; } // SignalR ConnectionId for denne enheten
    
    public DateTime? WebSocketConnectedAt { get; set; } // Når WebSocket ble tilkoblet
    
    public DateTime? WebSocketDisconnectedAt { get; set; } // Når WebSocket ble frakoblet
    
    [MaxLength(500)]
    public string? DisconnectionReason { get; set; } // Årsak til frakobling (error, manual, etc.)
    
    public int ReconnectionAttempts { get; set; } = 0; // Antall reconnection forsøk
    
    public DateTime? LastHeartbeat { get; set; } // Siste heartbeat mottatt
    
    // Egenskaper tilhørende forskjellige klienter om de kan 
    public string[] Capabilities { get; set; } = Array.Empty<string>();
    
    // 🆕 Metadata om tilkoblingen
    [MaxLength(1000)]
    public string? ConnectionMetadata { get; set; } // JSON string med ekstra info
    
    // Navigation property
    public virtual User User { get; set; }
}