namespace AFBack.Features.SignalR.DTOs;

/// <summary>
/// Metadata ekstrahert fra en SignalR connection request.
/// Immutable record for thread-safety.
/// </summary>
public sealed record ConnectionMetadata
{
    public required string UserId { get; init; }
    public required string DeviceId { get; init; }
    public required string ConnectionId { get; init; }
    public required string Platform { get; init; }
    public required string[] Capabilities { get; init; }
    public string? UserAgent { get; init; }
    public string? RemoteIpAddress { get; init; }
    public string? AppVersion { get; init; }
    public DateTime ConnectedAt { get; init; } = DateTime.UtcNow;

    /// <summary>
    /// Serialiserbar versjon for lagring.
    /// </summary>
    public object ToStorageFormat() => new
    {
        UserAgent,
        RemoteIpAddress,
        AppVersion,
        ConnectedAt,
        Platform,
        Capabilities
    };
}
