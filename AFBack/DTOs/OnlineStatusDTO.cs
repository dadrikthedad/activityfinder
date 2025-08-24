using System.ComponentModel.DataAnnotations;

namespace AFBack.DTOs;

public class OnlineStatusRequest
{
    
    [Required]
    public string Platform { get; set; }
    
    public long? LastBootstrapAt { get; set; }
    
    public string[] Capabilities { get; set; } = [];
}

public class OfflineStatusRequest
{
    [Required]
    public string DeviceId { get; set; }
}

public class OnlineStatusResponse
{
    public string Status { get; set; } = "ok";
    public long Timestamp { get; set; } = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
}