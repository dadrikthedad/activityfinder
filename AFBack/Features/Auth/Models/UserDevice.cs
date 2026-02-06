using System.ComponentModel.DataAnnotations;
using AFBack.Features.SignalR.Models;
using AFBack.Features.SyncEvents.Models;
using AFBack.Infrastructure.Security.Models;
using AFBack.Models.Enums;

namespace AFBack.Features.Auth.Models;

public class UserDevice
{
    // ======================== Primærnøkkel ========================
    public int Id { get; set; }
    
    // ======================== Foreign Key til AppUser ========================
    [Required, MaxLength(100)]
    public string UserId { get; set; } = null!;
    
    // ======================== Device metadata ========================
    
    [Required, MaxLength(200)]
    public string DeviceName { get; set; } = null!;
    
    [Required, MaxLength(500)]
    public string DeviceFingerprint { get; set; } = null!;
    
    public DateTime FirstSeenAt { get; set; } = DateTime.UtcNow;
    public DateTime LastUsedAt { get; set; } = DateTime.UtcNow;
    
    public bool IsTrusted { get; set; }
    
    [MaxLength(100)]
    public string? LastKnownLocation { get; set; }
    
    [MaxLength(45)]
    public string? LastIpAddress { get; set; }
    
    [EnumDataType(typeof(DeviceType))]
    public DeviceType DeviceType { get; set; } = DeviceType.Unknown;
    
    [EnumDataType(typeof(OperatingSystem))]
    public OperatingSystemType OperatingSystem { get; set; } = OperatingSystemType.Unknown;
    
    [MaxLength(100)]
    public string? Browser { get; set; }
    
    // ======================== Navigasjonsegenskaper ========================
    public AppUser AppUser { get; set; } = null!;
    public ICollection<UserConnection> Connections { get; set; } = new List<UserConnection>();
    public ICollection<LoginHistory> LoginHistory { get; set; } = new List<LoginHistory>();
    public ICollection<BanInfo> Bans { get; set; } = new List<BanInfo>();
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
    public ICollection<SuspiciousActivity> SuspiciousActivities { get; set; } = new List<SuspiciousActivity>();
    
    public DeviceSyncState? SyncState { get; set; }
}
