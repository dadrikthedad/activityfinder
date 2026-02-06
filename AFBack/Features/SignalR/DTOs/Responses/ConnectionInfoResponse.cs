namespace AFBack.Features.SignalR.DTOs.Responses;

/// <summary>
/// Returneres til klienten med info om gjeldende tilkobling.
/// </summary>
public sealed record ConnectionInfoResponse
{
    public required string ConnectionId { get; init; }
    public required string UserId { get; init; }
    public required string DeviceId { get; init; }
    public required string Platform { get; init; }
    public required DateTime ConnectedAt { get; init; }
}
