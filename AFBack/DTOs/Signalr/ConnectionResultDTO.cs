namespace AFBack.DTOs.Signalr;

public class ConnectionResultDTO
{
    public bool Success { get; set; } = true;
    public bool HasCollision { get; set; } = false;
    public string? PreviousConnectionId { get; set; }
    public List<string>? OtherDeviceConnections { get; set; }
}
