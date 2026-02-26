using System.Collections.Concurrent;
using System.Net;
using AFBack.Configurations.Options;
using AFBack.Data;
using AFBack.Features.Auth.Models;
using AFBack.Infrastructure.Security.Enums;
using AFBack.Infrastructure.Security.Models;
using AFBack.Infrastructure.Security.Repositories;
using AFBack.Infrastructure.Security.Utils;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Infrastructure.Security.Services;


/// <summary>
/// Håndterer IP-banning basert på mistenkelig aktivitet.
/// Bruker in-memory cache for rask oppslag og database for persistens.
/// 
/// Autentiserte misbrukere → bann brukerkontoen via Identity
/// Uautentiserte misbrukere → IP-ban via denne servicen
/// </summary>
public class IpBanService : IIpBanService
{
    private readonly ConcurrentDictionary<string, CachedIpBan> _bannedIpsCache = new();
    private readonly ConcurrentDictionary<string, DateTime> _notBannedIpsCache = new();
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<IpBanService> _logger;
    

    public IpBanService(
        IServiceScopeFactory scopeFactory,
        ILogger<IpBanService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;

        _ = Task.Run(LoadActiveBansAsync);
    }
    
    // ============================== Oppstartsmetode ==============================
    
    /// <summary>
    /// Laster aktive bans fra databasen ved oppstart inn i Cache. Sjekker om det er noen utgåtte bans, rydder opp
    /// i utgåtte
    /// </summary>
    private async Task LoadActiveBansAsync()
    {
        try
        {
            // Oppretter en context
            using var scope = _scopeFactory.CreateScope();
            var ipBanRepository = scope.ServiceProvider.GetRequiredService<IIpBanRepository>();
            
            // Henter aktive IpBans
            var activeBans = await ipBanRepository.GetAllActiveAsync();
            
            // Teller antall utgåtte IpBans
            var expiredIpBans = 0;
            
            // Sjekker om hver ban 
            foreach (var ban in activeBans)
            {
                // Sjekker om det er noen utløpte, midlertidige bans
                if (ban.IsExpired)
                {
                    // Setter IpBanen til false
                    ban.IsActive = false;
                    // legger til IpBan slik at vi vet vi må lagre i databasen
                    expiredIpBans++;
                    continue;
                }
                
                // Legger til gyldige bans i cache. Normaliserer det som en security sjekk
                var normalizedIp = IpUtils.NormalizeIpAdress(ban.IpAddress);
                
                if (string.IsNullOrEmpty(normalizedIp))
                {
                    _logger.LogWarning("Invalid IP in database ban: {IpAddress}", ban.IpAddress);
                    continue;
                }
                
                // Opprett CacheModell for den bannende Ip-en
                var cachedIpBan = new CachedIpBan
                {
                    IpAddress = normalizedIp,
                    BanType = ban.BanType,
                    ExpiresAt = ban.ExpiresAt,
                    CachedAt = DateTime.UtcNow
                };
                        
                // legg til i Cache
                _bannedIpsCache.TryAdd(normalizedIp, cachedIpBan);
            }
            
            // Hvis noen cacher har blitt oppdatert, lagre i databasen
            if (expiredIpBans > 0)
                await ipBanRepository.SaveChangesAsync();

            _logger.LogInformation("Loaded {Count} active IP bans, expired {Expired}",
                _bannedIpsCache.Count, expiredIpBans);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error loading active bans into cache");
        }
    }
    
    
    
    // ========================================== Ban  IP ==========================================
    
    /// <inheritdoc />
    public async Task BanIpAsync(string ipAddress, BanType banType, string reason, string? userId = null,
        string bannedBy = "System")
    {
        using var scope = _scopeFactory.CreateScope();
        var ipBanRepository = scope.ServiceProvider.GetRequiredService<IIpBanRepository>();
        var suspiciousActivityRepository = scope.ServiceProvider.GetRequiredService<ISuspiciousActivityRepository>();
        
        // Sjekker om brukeren er bannet for øyeblikket
        var ipBan = await ipBanRepository.GetByIpAsync(ipAddress);
        TimeSpan? duration;
        
        if (ipBan == null)
        {
            // =============== Ingen Ban ===================
            // Beregn varighet for ny ban utifra antall misstenksome aktiviteer. Permanent settes som null
            duration = banType == BanType.Permanent
                ? null
                : await CalculateBanDurationAsync(suspiciousActivityRepository, ipAddress);
            
            // Oppretter Ip Ban
            ipBan = new IpBan
            {
                IpAddress = ipAddress,
                BanType = banType,
                Reason = reason,
                BannedAt = DateTime.UtcNow,
                ExpiresAt = duration.HasValue
                    ? DateTime.UtcNow.Add(duration.Value)
                    : null,
                BannedByUserId = bannedBy,
                IsActive = true
            };
            
            // Legger til og lagrer
            await ipBanRepository.AddIpBanAsync(ipBan);
        }
        else
        {
            // Ikke nedjuster en permanent ban
            if (ipBan.BanType == BanType.Permanent)
            {
                _logger.LogDebug("IP {IP} already has permanent ban, skipping temporary", ipAddress);
                AddIpBanCached(ipAddress, ipBan);
                return;
            }

            // Beregn varighet basert på historikk
            duration = banType == BanType.Permanent
                ? null
                : await CalculateBanDurationAsync(suspiciousActivityRepository, ipAddress);
            
            // Oppdater banType og reason
            ipBan.BanType = banType;
            ipBan.Reason = reason;
            ipBan.BannedByUserId = bannedBy;
            ipBan.ExpiresAt = duration.HasValue // Hvis ban er permanent, så er duration null
                ? DateTime.UtcNow.Add(duration.Value)
                : null;

            await ipBanRepository.SaveChangesAsync();
        }
        
        var durationText = banType == BanType.Permanent
            ? "permanently"
            : $"for {duration!.Value.TotalHours}h (until {ipBan.ExpiresAt:yyyy-MM-dd HH:mm})";
        _logger.LogWarning("IP {IP} ban updated {Duration}. Reason: {Reason}", ipAddress, durationText, reason);
        
        // Ban brukeren med Identity samme tid hvis brukeren er autorisert
        if (!string.IsNullOrEmpty(userId))
        {
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
            var user = await userManager.FindByIdAsync(userId);
            if (user != null)
            {   
                // Hvis ban er permanent, så er duration null og vi setter da MaxValue istedenfor
                var lockoutEnd = duration.HasValue
                    ? DateTimeOffset.UtcNow.Add(duration.Value)
                    : DateTimeOffset.MaxValue; // Permanent
            
                await userManager.SetLockoutEndDateAsync(user, lockoutEnd);
                
                // TODO: Revoke token for brukeren når den er bannet
            }
        }
        
        
        AddIpBanCached(ipAddress, ipBan);
    }
    
    /// <summary>
    /// Oppretter en CachedIpBan fra et IpBan-objekt og cacher det i bannedIpsCachje og fjerner fra notBannedIpsCache
    /// </summary>
    /// <param name="ipAddress">IP-adressen som skal bannes</param>
    /// <param name="ipBan">IPBan objektet</param>
    private void AddIpBanCached(string ipAddress, IpBan ipBan)
    {
        var cached = new CachedIpBan
        {
            IpAddress = ipAddress,
            BanType = ipBan.BanType,
            ExpiresAt = ipBan.ExpiresAt,
            CachedAt = DateTime.UtcNow
        };

        _bannedIpsCache.AddOrUpdate(ipAddress, cached, (_, _) => cached);
        _notBannedIpsCache.TryRemove(ipAddress, out _);
    }
    
    /// <summary>
    /// Estimerer total tid en bruker skal være bannet utifra mistenksomme aktiviteter
    /// </summary>
    /// <param name="repository">Repository for å hente fra databasen</param>
    /// <param name="ipAddress">Ip-Addressen til den som skal bannes</param>
    /// <returns>TimeSpan med antall timer bannlyst</returns>
    private async Task<TimeSpan> CalculateBanDurationAsync(ISuspiciousActivityRepository repository, string ipAddress)
    {
        // Henter antall mistenksomme aktiviteter
        var totalActivities = await repository
            .GetSuspiciousActivitiesCountAsync(ipAddress, DateTime.MinValue);
        
        // Iterer igjennom BanEscalation og sjekker hvor mange mye straffen skal være
        foreach (var (threshold, multiplier) in IpBanConfig.BanEscalation)
        {
            // Ganger vi med straffen fra BanEscalation
            if (totalActivities < threshold)
                return IpBanConfig.BaseBanDuration * multiplier;
        }

        // Fallback — burde aldri nås pga int.MaxValue
        return IpBanConfig.BaseBanDuration * 168;
    }
    
    // ============================== Unban IP ==============================

    /// <inheritdoc />
    public async Task UnbanIpAsync(string ipAddress)
    {
        using var scope = _scopeFactory.CreateScope();
        var ipBanRepository = scope.ServiceProvider.GetRequiredService<IIpBanRepository>();

        var deactivated = await ipBanRepository.DeactivateIpBanAsync(ipAddress);

        // Oppdater cache
        _bannedIpsCache.TryRemove(ipAddress, out _);
        _notBannedIpsCache.TryAdd(ipAddress, DateTime.UtcNow);

        if (deactivated > 0)
            _logger.LogInformation("IP {IP} unbanned. {Count} ban(s) deactivated", ipAddress, deactivated);
    }
    
   
    
    // ============================== Sjekk om IP er banned ==============================
     
    /// <inheritdoc />
    public async Task<bool> IsIpBannedAsync(string? ipAddress)
    {
        // Validerer og normaliserer IP-adressen
        var normalizedIp = IpUtils.NormalizeIpAdress(ipAddress);
        if (string.IsNullOrEmpty(normalizedIp))
            return false; // Ingen IP = ingen ban
        
        if (IsWhitelisted(normalizedIp))
            return false; // IP kan ikke bli bannet

        // Sjekk positiv cache
        if (_bannedIpsCache.TryGetValue(normalizedIp, out var cachedBan))
        {
            // Ban utløpt
            if (cachedBan.IsExpired)
            {   
                await UnbanIpAsync(normalizedIp);
                return false; // Ikke bannet lenger
            }

            // Cache er fersk nok, ingen grunn til å sjekke database
            if (!cachedBan.NeedsRevalidation)
                return true; // Brukeren er fortsatt bannet
        }

        // Sjekk negativ cache
        if (_notBannedIpsCache.TryGetValue(normalizedIp, out var cachedAt))
        {   
            // Er negativ cache fortsatt fersk
            if (DateTime.UtcNow.Subtract(cachedAt) < IpBanConfig.NegativeCacheDuration)
                return false;  // Brukeren er notBannedIUpsCahce, altså ikke bannet
            
            // Ikke fersk, fjerne fra notBannedIpsCache
            _notBannedIpsCache.TryRemove(normalizedIp, out _);
        }

        // Database lookup — enten fordi ikke i cache, eller cache trenger revalidering
        using var scope = _scopeFactory.CreateScope();
        var ipBanRepository = scope.ServiceProvider.GetRequiredService<IIpBanRepository>();
        
        // Henter aktiv ban hvis det er en
        var activeBan = await ipBanRepository.GetByIpAsync(normalizedIp);
        
        // Hvis ingen active ban eller den er utgått unban
        if (activeBan == null || activeBan.IsExpired)
        {
            await UnbanIpAsync(normalizedIp); 
            return false; // Bruker ikke bannet lenger
        }
        
        // Oppdater cache
        AddIpBanCached(normalizedIp, activeBan);
        return true; // Bruker er bannet
    }
    
    // ============================== Helpers==============================
    
    /// <inheritdoc />
    public bool IsWhitelisted(string ipAddress)
    {
        // Sjekker om den er i listen
        if (IpBanConfig.WhitelistedIps.Contains(ipAddress))
            return true;
        
        // Sjekker om Ip-adressen er en gydlig adresse
        if (!IPAddress.TryParse(ipAddress, out var ip))
            return false;
        
        // Sjekker CIDR-ranges, som feks hvis vi bruker Gateway
        foreach (var entry in IpBanConfig.WhitelistedIps)
        {
            if (entry.Contains('/') &&
                IPNetwork.TryParse(entry, out var network) &&
                network.Contains(ip))
                return true;
        }

        return false;
    }
    
    // ============================== Maintence ==============================
    
    /// <summary>
    /// Rydder utløpte bans fra cache og database
    /// </summary>
    public async Task ClearExpiredFromCacheAsync(CancellationToken ct = default)
    {
        // Rydd utløpte IP-bans fra cache
        var expiredKeys = _bannedIpsCache
            .Where(kvp => kvp.Value.IsExpired)
            .Select(kvp => kvp.Key)
            .ToList();

        foreach (var key in expiredKeys)
            _bannedIpsCache.TryRemove(key, out _);

        // Rydd negativ cache
        var now = DateTime.UtcNow;
        var expiredNegative = _notBannedIpsCache
            .Where(kvp => now.Subtract(kvp.Value) > IpBanConfig.NegativeCacheDuration)
            .Select(kvp => kvp.Key)
            .ToList();

        foreach (var key in expiredNegative)
            _notBannedIpsCache.TryRemove(key, out _);

        // Deaktiver utløpte bans i database
        if (expiredKeys.Count > 0)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var deactivated = await context.IpBans
                .Where(b => b.IsActive && b.BanType == BanType.Temporary && DateTime.UtcNow > b.ExpiresAt)
                .ExecuteUpdateAsync(setters => setters.SetProperty(b => b.IsActive, false));

            _logger.LogInformation(
                "Cache cleanup: {CacheCount} expired bans from cache, {DbCount} deactivated in database",
                expiredKeys.Count, deactivated);
        }
    }
}
