using AFBack.Configurations.Options;
using AFBack.Constants;

namespace AFBack.Infrastructure.Security.Models;

/// <summary>
/// Modell for en IpBan som lagres i databasen
/// </summary>
public class CachedIpBan
{
    public string IpAddress { get; set; } = string.Empty;
    public BanType BanType { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public DateTime CachedAt { get; set; }
    
    /// <summary>
    /// Sjekker om Ip-banen er utløpt
    /// </summary>
    public bool IsExpired => BanType == BanType.Temporary && ExpiresAt.HasValue && DateTime.UtcNow > ExpiresAt;
    
    /// <summary>
    /// Sjekker om banen er i cache eller om vi må sjekke bannen i databasen
    /// </summary>
    public bool NeedsRevalidation => DateTime.UtcNow.Subtract(CachedAt) > IpBanConfig.CacheRevalidationInterval;

}
