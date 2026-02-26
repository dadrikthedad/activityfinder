using System.ComponentModel.DataAnnotations;
using AFBack.Features.Auth.Enums;

namespace AFBack.Features.Auth.DTOs.Request;

/// <summary>
/// Device-informasjon sendt fra klienten ved login.
/// DeviceFingerprint er en unik identifikator generert av klienten
/// som brukes for å matche refresh tokens til riktig device.
/// </summary>
public class DeviceInfoRequest
{
    [Required(ErrorMessage = "Device fingerprint is required")]
    [MaxLength(500, ErrorMessage = "Device fingerprint cannot exceed 500 characters")]
    public required string DeviceFingerprint { get; init; }
    
    [Required(ErrorMessage = "Device name is required")]
    [MaxLength(200, ErrorMessage = "Device name cannot exceed 200 characters")]
    public required string DeviceName { get; init; }
    
    public DeviceType DeviceType { get; init; } = DeviceType.Unknown;
    
    public OperatingSystemType OperatingSystem { get; init; } = OperatingSystemType.Unknown;
    
    [MaxLength(100)]
    public string? Browser { get; init; }
}
