namespace AFBack.Features.SignalR.DTOs.Responses;

/// <summary>
/// Sendes til klienten når samme enhet kobler til fra ny lokasjon.
/// </summary>
public sealed record DeviceCollisionResponse
{
    public required string Message { get; init; }
    public required string NewPlatform { get; init; }
    public required DateTime Timestamp { get; init; }
}
