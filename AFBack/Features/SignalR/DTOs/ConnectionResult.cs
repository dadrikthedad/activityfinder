namespace AFBack.Features.SignalR.DTOs;

/// <summary>
/// Resultat fra en connection-operasjon - intern DTO
/// </summary>
public sealed record ConnectionResult
{
    public bool Success { get; init; } = true;
    public bool HasCollision { get; init; }
    public string? PreviousConnectionId { get; init; }
    public IReadOnlyList<string> OtherDeviceConnections { get; init; } = [];
    public string? ErrorMessage { get; init; }

    public static ConnectionResult Successful(
        bool hasCollision = false,
        string? previousConnectionId = null,
        IReadOnlyList<string>? otherDevices = null) => new()
    {
        Success = true,
        HasCollision = hasCollision,
        PreviousConnectionId = previousConnectionId,
        OtherDeviceConnections = otherDevices ?? []
    };

    public static ConnectionResult Failed(string errorMessage) => new()
    {
        Success = false,
        ErrorMessage = errorMessage
    };
}
