namespace AFBack.DTOs.Security;

public class RateLimitContext
{
    public string? ClientIp { get; set; }
    public string? DeviceId { get; set; }
    public bool IsMobileApp { get; set; }
    public bool IsSharedNetwork { get; set; }
    public string PartitionKey { get; set; } = string.Empty;
}