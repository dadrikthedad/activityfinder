namespace AFBack.Features.SignalR.DTOs.Responses;

/// <summary>
/// Sendes til andre enheter når bruker logger inn fra ny enhet.
/// </summary>
public sealed record LoggedInElsewhereResponse
{
    public required string Message { get; init; }
    public required string DeviceInfo { get; init; }
    public required DateTime Timestamp { get; init; }
}
