using System.ComponentModel.DataAnnotations;
using AFBack.Features.Auth.Models;

namespace AFBack.Features.SignalR.Models;

public class UserConnection
{
    // ======================== Primærnøkkel ========================
    public int Id { get; set; }
    
    // ======================== Foreign Keys ========================
    [Required, MaxLength(100)]
    public string UserId { get; set; } = null!;
    public int UserDeviceId { get; set; }
    
    // ======================== SignalR/WebSocket ========================
    [Required, MaxLength(200)]
    public string ConnectionId { get; set; } = null!; // SignalR ConnectionId
    
    public bool IsConnected { get; set; } = true;
    
    public DateTime ConnectedAt { get; set; } = DateTime.UtcNow;
    
    
    // ======================== SignalR/WebSocket ========================
    
    public DateTime LastHeartbeat { get; set; } = DateTime.UtcNow;
    
    // ======================== Navigasjonsegenskaper ========================
    public AppUser AppUser { get; set; } = null!;
    public UserDevice UserDevice { get; set; } = null!;
}
