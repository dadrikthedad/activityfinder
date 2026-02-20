using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.Auth.DTOs.Request;

/// <summary>
/// Request for å fornye access token med refresh token.
/// DeviceFingerprint kreves for å verifisere at refresh token brukes fra riktig device.
/// </summary>
public class RefreshRequest
{
    [Required(ErrorMessage = "Refresh token is required")]
    public required string RefreshToken { get; init; }
    
    [Required(ErrorMessage = "Device fingerprint is required")]
    [MaxLength(500)]
    public required string DeviceFingerprint { get; init; }
}
