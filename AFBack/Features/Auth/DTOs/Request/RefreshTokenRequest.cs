namespace AFBack.Features.Auth.DTOs.Request;

public class RefreshTokenRequest
{
    public required string DeviceFingerprint { get; init; }
    public required string RefreshToken { get; init; }
}
