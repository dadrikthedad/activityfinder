using System.Collections.Concurrent;
using System.Net;
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
    private readonly ConcurrentDictionary<string, CachedBanInfo> _bannedDevicesCache = new();
    private readonly ConcurrentDictionary<string, DateTime> _negativeCache = new(); // Renamed for clarity
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<IpBanService> _logger;
    private readonly IpBanOptions _options;
    private readonly SemaphoreSlim _cleanupSemaphore = new(4, 4); // NYTT: Begrens samtidig cleanup til 4
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

    public async Task<bool> IsIpOrDeviceBannedAsync(string? ipAddress, string? deviceId = null)
    {
        ThrowIfDisposed();
        
        var normalizedIp = IpUtils.NormalizeIp(ipAddress);
        if (string.IsNullOrEmpty(normalizedIp)) return false;

        // Sjekk whitelist (supports CIDR ranges now)
        if (IsWhitelisted(normalizedIp))
            return false;

        var isSharedNetwork = IpUtils.IsFromSharedNetwork(normalizedIp);

        // For shared networks: prioritér device-ban over IP-ban
        if (isSharedNetwork)
        {
            // Sjekk device-ban først hvis vi har device ID
            if (!string.IsNullOrEmpty(deviceId))
            {
                var isDeviceBanned = await IsDeviceBannedAsync(deviceId);
                if (isDeviceBanned)
                {
                    _logger.LogDebug("Device {DeviceId} is banned on shared network IP {IP}", deviceId, normalizedIp);
                    return true;
                }
            }

            // For shared networks: ikke sjekk IP-ban, kun device-ban
            _logger.LogDebug("Shared network IP {IP} - skipping IP ban check", normalizedIp);
            return false;
        }

        // For private networks: sjekk både device og IP bans
        if (!string.IsNullOrEmpty(deviceId))
        {
            var isDeviceBanned = await IsDeviceBannedAsync(deviceId);
            if (isDeviceBanned)
            {
                _logger.LogDebug("Device {DeviceId} is banned on private network IP {IP}", deviceId, normalizedIp);
                return true;
            }
        }

        // Sjekk IP-ban (kun for private networks)
        return await IsIpBannedInternalAsync(normalizedIp);
    }

    private async Task<bool> IsDeviceBannedAsync(string deviceId)
    {
        if (string.IsNullOrEmpty(deviceId)) return false;

        // Sjekk device ban cache
        if (_bannedDevicesCache.TryGetValue(deviceId, out var cachedDeviceBan))
        {
            if (cachedDeviceBan.IsExpired)
            {
                _bannedDevicesCache.TryRemove(deviceId, out _);
                await DeactivateDeviceBanAsync(deviceId);
                return false;
            }
            return true;
        }

        // FORBEDRET: Sjekk negativ cache for devices
        if (_negativeCache.TryGetValue($"device:{deviceId}", out var cachedAt))
        {
            if (DateTime.UtcNow.Subtract(cachedAt) < _options.NegativeCacheDuration)
                return false;
            
            _negativeCache.TryRemove($"device:{deviceId}", out _);
        }

        // Database lookup
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        
        var activeBan = await context.BanInfos
            .Where(b => b.DeviceId == deviceId && b.IsActive)
            .FirstOrDefaultAsync();

        if (activeBan != null)
        {
            if (activeBan.BanType == BanType.Temporary && DateTime.UtcNow > activeBan.ExpiresAt)
            {
                activeBan.IsActive = false;
                await context.SaveChangesAsync();
                _logger.LogInformation("Temporary device ban expired for Device {DeviceId}", deviceId);
                
                // Add to negative cache
                _negativeCache.TryAdd($"device:{deviceId}", DateTime.UtcNow);
                return false;
            }

            // Add to positive cache
            _bannedDevicesCache.TryAdd(deviceId, CachedBanInfo.FromEntity(activeBan));
            return true;
        }

        // Add to negative cache
        _negativeCache.TryAdd($"device:{deviceId}", DateTime.UtcNow);
        return false;
    }

    private async Task<bool> IsIpBannedInternalAsync(string normalizedIp)
    {
        // Sjekk positiv cache
        if (_bannedIpsCache.TryGetValue(normalizedIp, out var cachedBan))
        {
            if (cachedBan.IsExpired)
            {
                _bannedIpsCache.TryRemove(normalizedIp, out _);
                await DeactivateBanAsync(normalizedIp);
                return false;
            }

            if (cachedBan.NeedsRevalidation)
            {
                return await RevalidateBanAsync(normalizedIp, cachedBan);
            }

            return true;
        }

        // Sjekk negative cache
        if (_negativeCache.TryGetValue($"ip:{normalizedIp}", out var cachedAt))
        {
            if (DateTime.UtcNow.Subtract(cachedAt) < _options.NegativeCacheDuration)
                return false;
            
            _negativeCache.TryRemove($"ip:{normalizedIp}", out _);
        }

        // Database lookup
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        
        var activeBan = await context.BanInfos
            .Where(b => b.IpAddress == normalizedIp && b.IsActive && string.IsNullOrEmpty(b.DeviceId))
            .FirstOrDefaultAsync();

        if (activeBan != null)
        {
            if (activeBan.BanType == BanType.Temporary && DateTime.UtcNow > activeBan.ExpiresAt)
            {
                activeBan.IsActive = false;
                await context.SaveChangesAsync();
                _logger.LogInformation("Temporary ban expired for IP {IP}", normalizedIp);
                
                _negativeCache.TryAdd($"ip:{normalizedIp}", DateTime.UtcNow);
                return false;
            }

            _bannedIpsCache.TryAdd(normalizedIp, CachedBanInfo.FromEntity(activeBan));
            return true;
        }

        _negativeCache.TryAdd($"ip:{normalizedIp}", DateTime.UtcNow);
        return false;
    }

    public async Task ReportSuspiciousActivityAsync(string? ipAddress, string activityType, string reason, 
        string? userAgent = null, string? endpoint = null, string? deviceId = null)
    {
        ThrowIfDisposed();
        
        var normalizedIp = IpUtils.NormalizeIp(ipAddress);
        if (string.IsNullOrEmpty(normalizedIp)) return;

        var isFromSharedNetwork = IpUtils.IsFromSharedNetwork(normalizedIp);
        
        // Ikke rapporter hvis whitelisted eller allerede bannet
        if (IsWhitelisted(normalizedIp) || await IsIpOrDeviceBannedAsync(normalizedIp, deviceId))
            return;

        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        // FORBEDRET: Lagre device ID i suspicious activity
        var activity = new SuspiciousActivity
        {
            IpAddress = normalizedIp,
            DeviceId = deviceId, // NYTT: Lagre device ID
            ActivityType = activityType,
            Reason = reason,
            Timestamp = DateTime.UtcNow,
            UserAgent = userAgent,
            Endpoint = endpoint
        };

        context.SuspiciousActivities.Add(activity);
        await context.SaveChangesAsync();

        // NYTT: Intelligent escalation basert på nettverkstype og device info
        await HandleSuspiciousActivityEscalationAsync(context, normalizedIp, deviceId, activityType, isFromSharedNetwork);
    }

    private async Task HandleSuspiciousActivityEscalationAsync(ApplicationDbContext context, string ipAddress, 
        string? deviceId, string activityType, bool isFromSharedNetwork)
    {
        if (isFromSharedNetwork && !string.IsNullOrEmpty(deviceId))
        {
            // Shared network + known device: sjekk device-basert escalation
            var deviceCount = await GetRecentSuspiciousCountAsync(context, null, deviceId);
            var deviceMaxAttempts = _options.MaxSuspiciousAttempts * 2; // 2x terskel for device-ban
            
            _logger.LogInformation("Suspicious activity from shared network - Device {DeviceId} on IP {IP}. Device count: {Count}", 
                deviceId, ipAddress, deviceCount);

            if (deviceCount >= deviceMaxAttempts)
            {
                await BanDeviceAsync(deviceId, BanType.Temporary, 
                    $"Auto-banned device after {deviceCount} suspicious activities from shared network", "System");
                
                _logger.LogWarning("Device {DeviceId} banned after {Count} suspicious activities from shared network IP {IP}", 
                    deviceId, deviceCount, ipAddress);
            }
        }
        else if (isFromSharedNetwork && string.IsNullOrEmpty(deviceId))
        {
            // Shared network + unknown device: kun logging, ingen ban
            var ipCount = await GetRecentSuspiciousCountAsync(context, ipAddress, null);
            _logger.LogInformation("Suspicious activity from shared network IP {IP} (no device ID). Count: {Count} - monitoring only", 
                ipAddress, ipCount);
        }
        else
        {
            // Private network: standard IP-basert escalation
            var ipCount = await GetRecentSuspiciousCountAsync(context, ipAddress, null);
            _logger.LogWarning("Suspicious activity from private network IP {IP}. Count: {Count}", ipAddress, ipCount);

            if (ipCount >= _options.MaxSuspiciousAttempts)
            {
                await BanIpInternalAsync(context, ipAddress, BanType.Temporary, 
                    $"Auto-banned after {ipCount} suspicious activities within {_options.SuspiciousWindow.TotalHours}h");
                await context.SaveChangesAsync();
            }
        }
    }

    public async Task BanDeviceAsync(string deviceId, BanType banType, string reason, string bannedBy = "System")
    {
        ThrowIfDisposed();
        
        if (string.IsNullOrEmpty(deviceId))
            throw new ArgumentException("Device ID cannot be null or empty", nameof(deviceId));

        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        // Deactivate existing device bans
        await context.BanInfos
            .Where(b => b.DeviceId == deviceId && b.IsActive)
            .ExecuteUpdateAsync(setters => setters.SetProperty(b => b.IsActive, false));

        var expiresAt = banType == BanType.Permanent ? DateTime.MaxValue : DateTime.UtcNow.Add(_options.TemporaryBanDuration);
        
        var banInfo = new BanInfo
        {
            DeviceId = deviceId, // NYTT: Device ID ban
            BanType = banType,
            Reason = reason,
            BannedAt = DateTime.UtcNow,
            ExpiresAt = expiresAt,
            BannedBy = bannedBy,
            IsActive = true
        };

        context.BanInfos.Add(banInfo);
        await context.SaveChangesAsync();

        // Update cache
        _bannedDevicesCache.AddOrUpdate(deviceId, CachedBanInfo.FromEntity(banInfo), (key, existing) => CachedBanInfo.FromEntity(banInfo));

        var banDuration = banType == BanType.Permanent ? "permanently" : $"until {expiresAt:yyyy-MM-dd HH:mm}";
        _logger.LogWarning("Device {DeviceId} banned {Duration}. Reason: {Reason}", deviceId, banDuration, reason);
    }

    // FORBEDRET: Support både IP og device lookup
    private async Task<int> GetRecentSuspiciousCountAsync(ApplicationDbContext context, string? ipAddress, string? deviceId)
    {
        var cutoff = DateTime.UtcNow.Subtract(_options.SuspiciousWindow);
        var query = context.SuspiciousActivities.Where(a => a.Timestamp > cutoff);

        if (!string.IsNullOrEmpty(ipAddress) && !string.IsNullOrEmpty(deviceId))
        {
            // Both IP and device - count activities from this device on any IP or this IP with any device
            return await query.Where(a => a.IpAddress == ipAddress || a.DeviceId == deviceId).CountAsync();
        }
        else if (!string.IsNullOrEmpty(ipAddress))
        {
            // IP only
            return await query.Where(a => a.IpAddress == ipAddress).CountAsync();
        }
        else if (!string.IsNullOrEmpty(deviceId))
        {
            // Device only
            return await query.Where(a => a.DeviceId == deviceId).CountAsync();
        }

        return 0;
    }

    // FORBEDRET: Whitelist with CIDR support
    private bool IsWhitelisted(string ipAddress)
    {
        if (_options.WhitelistedIps.Contains(ipAddress))
            return true;

        // Check if any whitelisted entry is a CIDR range
        if (!IPAddress.TryParse(ipAddress, out var ip))
            return false;

        foreach (var whitelistEntry in _options.WhitelistedIps)
        {
            if (whitelistEntry.Contains('/'))
            {
                // CIDR format
                if (IPNetwork.TryParse(whitelistEntry, out var network) && network.Contains(ip))
                    return true;
            }
        }

        return false;
    }

    // FORBEDRET: Heuristikk for IPv6 - mer restriktiv
    // Dette bør flyttes til IpUtils, men viser logikken her
    private static bool IsFromSharedNetworkImproved(string ipAddress)
    {
        if (string.IsNullOrEmpty(ipAddress) || !IPAddress.TryParse(ipAddress, out var ip))
            return false;
            
        if (ip.AddressFamily == System.Net.Sockets.AddressFamily.InterNetworkV6)
        {
            var bytes = ip.GetAddressBytes();
            
            // Kun spesifikke IPv6 ranges, ikke "alle"
            // fc00::/7 (Unique Local - ofte mobilnettverk)
            if ((bytes[0] & 0xFE) == 0xFC) return true;
            
            // fe80::/10 (Link-local)
            if (bytes[0] == 0xFE && (bytes[1] & 0xC0) == 0x80) return true;
            
            // Spesifikke carrier ranges (kun kjente)
            if (bytes[0] == 0x20 && bytes[1] == 0x01 && (bytes[2] & 0xF8) == 0x70 && bytes[3] == 0x00) return true; // Telenor
            
            // IKKE returner true for alle andre IPv6 - kun kjente shared ranges
            return false;
        }
        
        // IPv4 logic unchanged...
        return IpUtils.IsFromSharedNetwork(ipAddress);
    }

    private async Task DeactivateDeviceBanAsync(string deviceId)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var updatedCount = await context.BanInfos
            .Where(b => b.DeviceId == deviceId && b.IsActive && b.BanType == BanType.Temporary && DateTime.UtcNow > b.ExpiresAt)
            .ExecuteUpdateAsync(setters => setters.SetProperty(b => b.IsActive, false));

        if (updatedCount > 0)
        {
            _logger.LogInformation("Temporary device ban expired for Device {DeviceId}", deviceId);
        }
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
            var sharedNetworkBans = 0;
            var deviceBans = 0;

            foreach (var ban in activeBans)
            {
                var normalizedIp = IpUtils.NormalizeIp(ban.IpAddress);
                
                // Sjekk om temporary ban er utløpt
                if (ban.BanType == BanType.Temporary && now > ban.ExpiresAt)
                {
                    ban.IsActive = false;
                    expiredCount++;
                    continue;
                }

                // NYTT: Håndter både IP og device bans
                if (!string.IsNullOrEmpty(ban.DeviceId))
                {
                    // Device ban
                    _bannedDevicesCache.TryAdd(ban.DeviceId, CachedBanInfo.FromEntity(ban));
                    deviceBans++;
                }
                else if (!string.IsNullOrEmpty(normalizedIp))
                {
                    // IP ban
                    _bannedIpsCache.TryAdd(normalizedIp, CachedBanInfo.FromEntity(ban));
                    
                    if (IpUtils.IsFromSharedNetwork(normalizedIp))
                    {
                        sharedNetworkBans++;
                    }
                }
            }

            if (expiredCount > 0)
            {
                await context.SaveChangesAsync();
            }
            
            _logger.LogInformation("Loaded {IpBans} IP bans and {DeviceBans} device bans into cache (including {SharedCount} shared network IP bans), expired {ExpiredCount} bans", 
                _bannedIpsCache.Count, deviceBans, sharedNetworkBans, expiredCount);
                
            if (sharedNetworkBans > 0)
            {
                _logger.LogWarning("WARNING: {SharedCount} active IP bans target shared network IPs - consider reviewing these", sharedNetworkBans);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error loading active bans into cache");
        }
    }

    private async Task<bool> RevalidateBanAsync(string ipAddress, CachedBanInfo cachedBan)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var activeBan = await context.BanInfos
            .Where(b => b.IpAddress == ipAddress && b.IsActive && string.IsNullOrEmpty(b.DeviceId))
            .FirstOrDefaultAsync();

        if (activeBan == null || (activeBan.BanType == BanType.Temporary && DateTime.UtcNow > activeBan.ExpiresAt))
        {
            // Ban no longer exists or expired
            _bannedIpsCache.TryRemove(ipAddress, out _);
            _negativeCache.TryAdd($"ip:{ipAddress}", DateTime.UtcNow);
            return false;
        }

        // Update cache with fresh data
        _bannedIpsCache.TryUpdate(ipAddress, CachedBanInfo.FromEntity(activeBan), cachedBan);
        return true;
    }

    private async Task BanIpInternalAsync(ApplicationDbContext context, string ipAddress, BanType banType, 
        string reason, string bannedBy = "System")
    {
        // Bulk deactivate existing IP bans
        await context.BanInfos
            .Where(b => b.IpAddress == ipAddress && b.IsActive && string.IsNullOrEmpty(b.DeviceId))
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
        _negativeCache.TryRemove($"ip:{ipAddress}", out _);

        var banDuration = banType == BanType.Permanent ? "permanently" : $"until {expiresAt:yyyy-MM-dd HH:mm}";
        var networkType = IpUtils.IsFromSharedNetwork(ipAddress) ? "shared network" : "private network";
        _logger.LogWarning("IP {IP} ({NetworkType}) banned {Duration}. Reason: {Reason}", 
            ipAddress, networkType, banDuration, reason);
    }

    private async Task DeactivateBanAsync(string ipAddress)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var updatedCount = await context.BanInfos
            .Where(b => b.IpAddress == ipAddress && b.IsActive && b.BanType == BanType.Temporary && 
                   DateTime.UtcNow > b.ExpiresAt && string.IsNullOrEmpty(b.DeviceId))
            .ExecuteUpdateAsync(setters => setters.SetProperty(b => b.IsActive, false));

        if (updatedCount > 0)
        {
            _logger.LogInformation("Temporary IP ban expired and deactivated for IP {IP}", ipAddress);
        }
    }

    public void ClearExpiredFromCache()
    {
        var now = DateTime.UtcNow;
        
        // Clean expired IP bans
        var expiredIpKeys = _bannedIpsCache
            .Where(kvp => kvp.Value.IsExpired)
            .Select(kvp => kvp.Key)
            .ToList();

        foreach (var key in expiredIpKeys)
        {
            _bannedIpsCache.TryRemove(key, out _);
        }

        // Clean expired device bans
        var expiredDeviceKeys = _bannedDevicesCache
            .Where(kvp => kvp.Value.IsExpired)
            .Select(kvp => kvp.Key)
            .ToList();

        foreach (var key in expiredDeviceKeys)
        {
            _bannedDevicesCache.TryRemove(key, out _);
        }

        // Clean negative cache
        var expiredNegative = _negativeCache
            .Where(kvp => now.Subtract(kvp.Value) > _options.NegativeCacheDuration)
            .Select(kvp => kvp.Key)
            .ToList();

        foreach (var key in expiredNegative)
        {
            _negativeCache.TryRemove(key, out _);
        }

        // FORBEDRET: Kjør database cleanup i bakgrunnen med begrenset samtidighet
        if (expiredIpKeys.Count > 0 || expiredDeviceKeys.Count > 0)
        {
            _logger.LogInformation("Cleared {IpCount} expired IP bans and {DeviceCount} expired device bans from cache, starting database cleanup", 
                expiredIpKeys.Count, expiredDeviceKeys.Count);
                
            // Start database cleanup i bakgrunnen
            _ = Task.Run(async () => await PerformDatabaseCleanupAsync(expiredIpKeys, expiredDeviceKeys));
        }
    }

    /// <summary>
    /// NYTT: Utfører database cleanup med begrenset samtidighet
    /// </summary>
    private async Task PerformDatabaseCleanupAsync(List<string> expiredIpKeys, List<string> expiredDeviceKeys)
    {
        var totalTasks = expiredIpKeys.Count + expiredDeviceKeys.Count;
        if (totalTasks == 0) return;

        try
        {
            var tasks = new List<Task>();
            
            // Lag tasks for IP cleanup
            foreach (var ipKey in expiredIpKeys)
            {
                tasks.Add(PerformThrottledCleanupAsync(() => DeactivateBanAsync(ipKey), "IP", ipKey));
            }
            
            // Lag tasks for device cleanup
            foreach (var deviceKey in expiredDeviceKeys)
            {
                tasks.Add(PerformThrottledCleanupAsync(() => DeactivateDeviceBanAsync(deviceKey), "Device", deviceKey));
            }
            
            // Vent på at alle tasks er ferdige
            await Task.WhenAll(tasks);
            
            _logger.LogInformation("Database cleanup completed for {TotalCount} expired bans", totalTasks);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during database cleanup of expired bans");
        }
    }

    /// <summary>
    /// NYTT: Utfører throttled cleanup med semaphore
    /// </summary>
    private async Task PerformThrottledCleanupAsync(Func<Task> cleanupAction, string type, string key)
    {
        await _cleanupSemaphore.WaitAsync();
        try
        {
            await cleanupAction();
            _logger.LogDebug("Deactivated expired {Type} ban: {Key}", type, key);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to deactivate {Type} ban: {Key}", type, key);
        }
        finally
        {
            _cleanupSemaphore.Release();
        }
    }

    public async Task<List<BanInfo>> GetActiveBannedIpsAsync()
    {
        ThrowIfDisposed();
        
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        
        return await context.BanInfos
            .Where(b => b.IsActive && !string.IsNullOrEmpty(b.IpAddress))
            .OrderByDescending(b => b.BannedAt)
            .ToListAsync();
    }

    public async Task<List<BanInfo>> GetActiveBannedDevicesAsync()
    {
        ThrowIfDisposed();
        
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        
        return await context.BanInfos
            .Where(b => b.IsActive && !string.IsNullOrEmpty(b.DeviceId))
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

    // Legacy method for backward compatibility
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

    // NYTT: Legacy method support
    public async Task BanIpAsync(string ipAddress, BanType banType, string reason, string bannedBy = "System")
    {
        ThrowIfDisposed();
        
        var normalizedIp = IpUtils.NormalizeIp(ipAddress);
        if (string.IsNullOrEmpty(normalizedIp))
            throw new ArgumentException("Invalid IP address", nameof(ipAddress));

        // NYTT: Advarsler om shared network banning
        if (IpUtils.IsFromSharedNetwork(normalizedIp))
        {
            _logger.LogWarning("WARNING: Attempting to ban shared network IP {IP} - this may affect many legitimate users!", normalizedIp);
            reason = $"[SHARED_NETWORK] {reason}";
        }

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

        // Bulk update to deactivate all active IP bans
        var updatedCount = await context.BanInfos
            .Where(b => b.IpAddress == normalizedIp && b.IsActive && string.IsNullOrEmpty(b.DeviceId))
            .ExecuteUpdateAsync(setters => setters.SetProperty(b => b.IsActive, false));

        if (updatedCount > 0)
        {
            var networkType = IpUtils.IsFromSharedNetwork(normalizedIp) ? "shared network" : "private network";
            _logger.LogInformation("IP {IP} ({NetworkType}) unbanned. Deactivated {Count} ban(s)", 
                normalizedIp, networkType, updatedCount);
        }

        // Clear from caches
        _bannedIpsCache.TryRemove(normalizedIp, out _);
        _negativeCache.TryAdd($"ip:{normalizedIp}", DateTime.UtcNow);
    }

    public async Task UnbanDeviceAsync(string deviceId)
    {
        ThrowIfDisposed();
        
        if (string.IsNullOrEmpty(deviceId)) return;

        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        // Bulk update to deactivate all active device bans
        var updatedCount = await context.BanInfos
            .Where(b => b.DeviceId == deviceId && b.IsActive)
            .ExecuteUpdateAsync(setters => setters.SetProperty(b => b.IsActive, false));

        if (updatedCount > 0)
        {
            _logger.LogInformation("Device {DeviceId} unbanned. Deactivated {Count} ban(s)", deviceId, updatedCount);
        }

        // Clear from caches
        _bannedDevicesCache.TryRemove(deviceId, out _);
        _negativeCache.TryAdd($"device:{deviceId}", DateTime.UtcNow);
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
            _cleanupSemaphore?.Dispose(); // NYTT: Dispose semaphore
            _disposed = true;
        }
    }
}