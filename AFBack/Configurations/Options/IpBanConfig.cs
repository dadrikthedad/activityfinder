namespace AFBack.Configurations.Options;

/// <summary>
/// Statisk konfigurasjon for IP-banning.
/// Endres kun ved redeployment.
/// </summary>
public static class IpBanConfig
{
    public static readonly TimeSpan TemporaryBanDuration = TimeSpan.FromHours(24);
    public static readonly int MaxSuspiciousAttempts = 20;
    public static readonly TimeSpan SuspiciousWindow = TimeSpan.FromHours(1);
    public static readonly TimeSpan CacheRevalidationInterval = TimeSpan.FromMinutes(5);
    public static readonly TimeSpan NegativeCacheDuration = TimeSpan.FromMinutes(2);
    public static readonly TimeSpan CleanupInterval = TimeSpan.FromHours(1);

    // Whitelisted IPs (interne tjenester, admin, CI/CD)
    public static readonly List<string> WhitelistedIps = [ "127.0.0.1",
        "::1",
        "169.254.130.1"];
    
    
    public static readonly TimeSpan BaseBanDuration = TimeSpan.FromHours(1);
    public static readonly (int Threshold, int Multiplier)[] BanEscalation =
    [
        (10, 1),    // < 10 aktiviteter: 1 time
        (20, 4),    // < 20: 4 timer
        (30, 24),   // < 30: 24 timer
        (int.MaxValue, 168) // 30+: 1 uke
    ];
}
