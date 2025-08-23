using AFBack.Constants;

namespace AFBack.Models;

public class BanInfo
{
    public int Id { get; set; }
    public string IpAddress { get; set; } = string.Empty;
    public BanType BanType { get; set; }
    public string Reason { get; set; } = string.Empty;
    public DateTime BannedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public string BannedBy { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true; // For soft delete
}