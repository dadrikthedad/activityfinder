using AFBack.Constants;
using AFBack.Models;

namespace AFBack.Services;

// Immutable cache-verdi for å unngå EF-entity problemer
public record CachedBanInfo(
    string IpAddress,
    BanType BanType,
    DateTime ExpiresAt,
    DateTime CachedAt
)
{
    public bool IsExpired => BanType == BanType.Temporary && DateTime.UtcNow > ExpiresAt;
    
    // Kort TTL for positive cache hits for multi-instance scenarios
    public bool NeedsRevalidation => DateTime.UtcNow.Subtract(CachedAt) > TimeSpan.FromMinutes(5);
    
    public static CachedBanInfo FromEntity(BanInfo entity)
    {
        return new CachedBanInfo(
            entity.IpAddress,
            entity.BanType,
            entity.ExpiresAt,
            DateTime.UtcNow
        );
    }
}