namespace AFBack.Configuration;

public class IpBanOptions
{
    public const string SectionName = "IpBan";

    public TimeSpan TemporaryBanDuration { get; set; } = TimeSpan.FromHours(24);
    public int MaxSuspiciousAttempts { get; set; } = 20;
    public TimeSpan SuspiciousWindow { get; set; } = TimeSpan.FromHours(1);
    public TimeSpan CacheRevalidationInterval { get; set; } = TimeSpan.FromMinutes(5);
    public TimeSpan NegativeCacheDuration { get; set; } = TimeSpan.FromMinutes(2);
    public TimeSpan CleanupInterval { get; set; } = TimeSpan.FromHours(1);
    
    // Whitelisted IPs (internal services, admin etc)
    public List<string> WhitelistedIps { get; set; } = new();
}