namespace AFBack.Models;

public class SuspiciousActivity
{
    public int Id { get; set; }
    public string IpAddress { get; set; } = string.Empty;
    public string ActivityType { get; set; } = string.Empty; // "FailedLogin", "TooManyRequests", etc.
    public string Reason { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public string? UserAgent { get; set; } // Ekstra info for analyse
    public string? Endpoint { get; set; } // Hvilket endpoint som ble truffet
}