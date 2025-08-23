using System.Collections.Concurrent;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using AFBack.Configuration;
using AFBack.Constants;
using AFBack.Data;
using AFBack.Models;
using AFBack.Utils;

namespace AFBack.Services;

public class IpBanService : IDisposable
{
    private readonly ConcurrentDictionary<string, CachedBanInfo> _bannedIpsCache = new();
    private readonly ConcurrentDictionary<string, DateTime> _negativeCacheCache = new();
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<IpBanService> _logger;
    private readonly IpBanOptions _options;
    private bool _disposed = false;

    public IpBanService(
        IServiceScopeFactory scopeFactory, 
        ILogger<IpBanService> logger,
        IOptions<IpBanOptions> options)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _options = options.Value;
        
        // Last inn aktive bans i cache ved oppstart
        _ = Task.Run(LoadActiveBansAsync);
    }

    public async Task<bool> IsIpBannedAsync(string? ipAddress)
    {
        ThrowIfDisposed();
        
        var normalizedIp = IpUtils.NormalizeIp(ipAddress);
        if (string.IsNullOrEmpty(normalizedIp)) return false;

        // Sjekk whitelist
        if (_options.WhitelistedIps.Contains(normalizedIp))
            return false;

        // Sjekk positiv cache
        if (_bannedIpsCache.TryGetValue(normalizedIp, out var cachedBan))
        {
            if (cachedBan.IsExpired)
            {
                _bannedIpsCache.TryRemove(normalizedIp, out _);
                await DeactivateBanAsync(normalizedIp);
                return false;
            }

            // Revalidering for multi-instance scenarios
            if (cachedBan.NeedsRevalidation)
            {
                return await RevalidateBanAsync(normalizedIp, cachedBan);
            }

            return true;
        }

        // Sjekk negativ cache
        if (_negativeCacheCache.TryGetValue(normalizedIp, out var cachedAt))
        {
            if (DateTime.UtcNow.Subtract(cachedAt) < _options.NegativeCacheDuration)
                return false;
            
            _negativeCacheCache.TryRemove(normalizedIp, out _);
        }

        // Database lookup
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        
        var activeBan = await context.BanInfos
            .Where(b => b.IpAddress == normalizedIp && b.IsActive)
            .FirstOrDefaultAsync();

        if (activeBan != null)
        {
            if (activeBan.BanType == BanType.Temporary && DateTime.UtcNow > activeBan.ExpiresAt)
            {
                activeBan.IsActive = false;
                await context.SaveChangesAsync();
                _logger.LogInformation("Temporary ban expired for IP {IP}", normalizedIp);
                
                // Add to negative cache
                _negativeCacheCache.TryAdd(normalizedIp, DateTime.UtcNow);
                return false;
            }

            // Add to positive cache
            _bannedIpsCache.TryAdd(normalizedIp, CachedBanInfo.FromEntity(activeBan));
            return true;
        }

        // Add to negative cache
        _negativeCacheCache.TryAdd(normalizedIp, DateTime.UtcNow);
        return false;
    }

    public async Task ReportSuspiciousActivityAsync(string? ipAddress, string activityType, string reason, 
        string? userAgent = null, string? endpoint = null)
    {
        ThrowIfDisposed();
        
        var normalizedIp = IpUtils.NormalizeIp(ipAddress);
        if (string.IsNullOrEmpty(normalizedIp)) return;

        // Ikke rapporter hvis whitelisted eller allerede bannet
        if (_options.WhitelistedIps.Contains(normalizedIp) || await IsIpBannedAsync(normalizedIp))
            return;

        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        // Lagre ny mistenkelig aktivitet
        var activity = new SuspiciousActivity
        {
            IpAddress = normalizedIp,
            ActivityType = activityType,
            Reason = reason,
            Timestamp = DateTime.UtcNow,
            UserAgent = userAgent,
            Endpoint = endpoint
        };

        context.SuspiciousActivities.Add(activity);
        await context.SaveChangesAsync(); // Save first, then count

        // Tell opp nylige mistenkelige aktiviteter
        var recentCount = await GetRecentSuspiciousCountAsync(context, normalizedIp);
        
        _logger.LogWarning("Suspicious activity from IP {IP}: {ActivityType} - {Reason}. Recent count: {Count}", 
            normalizedIp, activityType, reason, recentCount);

        // Auto-ban hvis for mange mistenkelige forsøk
        if (recentCount >= _options.MaxSuspiciousAttempts)
        {
            await BanIpInternalAsync(context, normalizedIp, BanType.Temporary, 
                $"Auto-banned after {recentCount} suspicious activities within {_options.SuspiciousWindow.TotalHours}h");
            await context.SaveChangesAsync();
        }
    }

    public async Task BanIpAsync(string ipAddress, BanType banType, string reason, string bannedBy = "System")
    {
        ThrowIfDisposed();
        
        var normalizedIp = IpUtils.NormalizeIp(ipAddress);
        if (string.IsNullOrEmpty(normalizedIp))
            throw new ArgumentException("Invalid IP address", nameof(ipAddress));

        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        
        await BanIpInternalAsync(context, normalizedIp, banType, reason, bannedBy);
        await context.SaveChangesAsync();
    }

    public async Task UnbanIpAsync(string ipAddress)
    {
        ThrowIfDisposed();
        
        var normalizedIp = IpUtils.NormalizeIp(ipAddress);
        if (string.IsNullOrEmpty(normalizedIp)) return;

        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        // Bulk update to deactivate all active bans
        var updatedCount = await context.BanInfos
            .Where(b => b.IpAddress == normalizedIp && b.IsActive)
            .ExecuteUpdateAsync(setters => setters.SetProperty(b => b.IsActive, false));

        if (updatedCount > 0)
        {
            _logger.LogInformation("IP {IP} unbanned. Deactivated {Count} ban(s)", normalizedIp, updatedCount);
        }

        // Clear from all caches
        _bannedIpsCache.TryRemove(normalizedIp, out _);
        _negativeCacheCache.TryAdd(normalizedIp, DateTime.UtcNow);
    }

    private async Task<bool> RevalidateBanAsync(string ipAddress, CachedBanInfo cachedBan)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var activeBan = await context.BanInfos
            .Where(b => b.IpAddress == ipAddress && b.IsActive)
            .FirstOrDefaultAsync();

        if (activeBan == null || (activeBan.BanType == BanType.Temporary && DateTime.UtcNow > activeBan.ExpiresAt))
        {
            // Ban no longer exists or expired
            _bannedIpsCache.TryRemove(ipAddress, out _);
            _negativeCacheCache.TryAdd(ipAddress, DateTime.UtcNow);
            return false;
        }

        // Update cache with fresh data
        _bannedIpsCache.TryUpdate(ipAddress, CachedBanInfo.FromEntity(activeBan), cachedBan);
        return true;
    }

    private async Task<int> GetRecentSuspiciousCountAsync(ApplicationDbContext context, string ipAddress)
    {
        var cutoff = DateTime.UtcNow.Subtract(_options.SuspiciousWindow);
        return await context.SuspiciousActivities
            .Where(a => a.IpAddress == ipAddress && a.Timestamp > cutoff)
            .CountAsync();
    }

    private async Task BanIpInternalAsync(ApplicationDbContext context, string ipAddress, BanType banType, 
        string reason, string bannedBy = "System")
    {
        // Bulk deactivate existing bans
        await context.BanInfos
            .Where(b => b.IpAddress == ipAddress && b.IsActive)
            .ExecuteUpdateAsync(setters => setters.SetProperty(b => b.IsActive, false));

        // Create new ban
        var expiresAt = banType == BanType.Permanent ? DateTime.MaxValue : DateTime.UtcNow.Add(_options.TemporaryBanDuration);
        
        var banInfo = new BanInfo
        {
            IpAddress = ipAddress,
            BanType = banType,
            Reason = reason,
            BannedAt = DateTime.UtcNow,
            ExpiresAt = expiresAt,
            BannedBy = bannedBy,
            IsActive = true
        };

        context.BanInfos.Add(banInfo);

        // Update caches
        _bannedIpsCache.AddOrUpdate(ipAddress, CachedBanInfo.FromEntity(banInfo), (key, existing) => CachedBanInfo.FromEntity(banInfo));
        _negativeCacheCache.TryRemove(ipAddress, out _);

        var banDuration = banType == BanType.Permanent ? "permanently" : $"until {expiresAt:yyyy-MM-dd HH:mm}";
        _logger.LogWarning("IP {IP} banned {Duration}. Reason: {Reason}", ipAddress, banDuration, reason);
    }

    public void ClearExpiredFromCache()
    {
        var now = DateTime.UtcNow;
        var expiredKeys = _bannedIpsCache
            .Where(kvp => kvp.Value.IsExpired)
            .Select(kvp => kvp.Key)
            .ToList();

        foreach (var key in expiredKeys)
        {
            _bannedIpsCache.TryRemove(key, out _);
        }

        // Clean negative cache
        var expiredNegative = _negativeCacheCache
            .Where(kvp => now.Subtract(kvp.Value) > _options.NegativeCacheDuration)
            .Select(kvp => kvp.Key)
            .ToList();

        foreach (var key in expiredNegative)
        {
            _negativeCacheCache.TryRemove(key, out _);
        }
    }

    public async Task<List<BanInfo>> GetActiveBannedIpsAsync()
    {
        ThrowIfDisposed();
        
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        
        return await context.BanInfos
            .Where(b => b.IsActive)
            .OrderByDescending(b => b.BannedAt)
            .ToListAsync();
    }

    public async Task<List<SuspiciousActivity>> GetRecentSuspiciousActivitiesAsync(int take = 100)
    {
        ThrowIfDisposed();
        
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        
        var cutoff = DateTime.UtcNow.Subtract(_options.SuspiciousWindow);
        
        return await context.SuspiciousActivities
            .Where(s => s.Timestamp > cutoff)
            .OrderByDescending(s => s.Timestamp)
            .Take(take)
            .ToListAsync();
    }

    public async Task<Dictionary<string, int>> GetSuspiciousActivitySummaryAsync()
    {
        ThrowIfDisposed();
        
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        
        var cutoff = DateTime.UtcNow.Subtract(_options.SuspiciousWindow);
        
        return await context.SuspiciousActivities
            .Where(s => s.Timestamp > cutoff)
            .GroupBy(s => s.IpAddress)
            .Select(g => new { IpAddress = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count)
            .ToDictionaryAsync(x => x.IpAddress, x => x.Count);
    }

    private async Task LoadActiveBansAsync()
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var activeBans = await context.BanInfos
                .Where(b => b.IsActive)
                .ToListAsync();

            var now = DateTime.UtcNow;
            var expiredCount = 0;

            foreach (var ban in activeBans)
            {
                var normalizedIp = IpUtils.NormalizeIp(ban.IpAddress);
                if (string.IsNullOrEmpty(normalizedIp)) continue;

                // Sjekk om temporary ban er utløpt
                if (ban.BanType == BanType.Temporary && now > ban.ExpiresAt)
                {
                    ban.IsActive = false;
                    expiredCount++;
                }
                else
                {
                    _bannedIpsCache.TryAdd(normalizedIp, CachedBanInfo.FromEntity(ban));
                }
            }

            if (expiredCount > 0)
            {
                await context.SaveChangesAsync();
                _logger.LogInformation("Loaded {ActiveCount} active bans into cache, expired {ExpiredCount} bans", 
                    _bannedIpsCache.Count, expiredCount);
            }
            else
            {
                _logger.LogInformation("Loaded {ActiveCount} active bans into cache", _bannedIpsCache.Count);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error loading active bans into cache");
        }
    }

    private async Task DeactivateBanAsync(string ipAddress)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var updatedCount = await context.BanInfos
            .Where(b => b.IpAddress == ipAddress && b.IsActive && b.BanType == BanType.Temporary && DateTime.UtcNow > b.ExpiresAt)
            .ExecuteUpdateAsync(setters => setters.SetProperty(b => b.IsActive, false));

        if (updatedCount > 0)
        {
            _logger.LogInformation("Temporary ban expired and deactivated for IP {IP}", ipAddress);
        }
    }


    
    private void ThrowIfDisposed()
    {
        if (_disposed)
            throw new ObjectDisposedException(nameof(IpBanService));
    }

    public void Dispose()
    {
        if (!_disposed)
        {
            _disposed = true;
        }
    }
}