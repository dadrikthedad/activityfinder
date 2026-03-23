using System.Collections.Concurrent;
using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Configurations.Options;
using AFBack.Infrastructure.Sms.Enums;

namespace AFBack.Infrastructure.Security.Services;

public class SmsRateLimitService(ILogger<SmsRateLimitService> logger) : ISmsRateLimitService
{
    // ========================= In-Memory database ========================
    /// <summary>
    /// Siste tidspunkt en SMS ble sendt per type+telefonnummer. Brukes til cooldown-sjekk.
    /// Key = "{SmsType}:{phoneNumber}", Value = tidspunkt for siste sending.
    /// </summary>
    private readonly ConcurrentDictionary<string, DateTime> _lastSentTimestamps = new();

    /// <summary>
    /// Alle sendetidspunkter innenfor dagvinduet per type+telefonnummer.
    /// Key = "{SmsType}:{phoneNumber}", Value = liste med tidspunkter.
    /// Brukes til daglig grense.
    /// </summary>
    private readonly ConcurrentDictionary<string, Lazy<List<DateTime>>> _dailySendHistory = new();

    /// <summary>
    /// Alle sendetidspunkter innenfor IP-vinduet — delt på tvers av SMS-typer.
    /// Key = IP-adresse, Value = liste med tidspunkter.
    /// Brukes til IP-grense.
    /// </summary>
    private readonly ConcurrentDictionary<string, Lazy<List<DateTime>>> _ipSendHistory = new();

    
    // ========================= Henter settings som TimeSpan ========================
    private static readonly TimeSpan DayWindow = TimeSpan.FromHours(SmsRateLimitConfig.SmsDayWindowHours);
    private static readonly TimeSpan IpWindow = TimeSpan.FromMinutes(SmsRateLimitConfig.SmsIpWindowMinutes);
    
    // ========================= Service metoder ========================
    
    /// <inheritdoc />
    public Result CanSendSms(SmsType smsType, string phoneNumber, string? ipAddress = null)
    {
        if (string.IsNullOrEmpty(phoneNumber))
            throw new ArgumentException("Phone number cannot be null or empty", nameof(phoneNumber));

        var now = DateTime.UtcNow;
        
        // Vi lager en key utifra type SMS og til hvilket nummer. Eks "Verification:+4712345678"
        var smsTypeKey = GetTypeKey(smsType, phoneNumber);

        // ====== IP-basert grense — delt på tvers av alle SMS-typer ======
        if (!string.IsNullOrEmpty(ipAddress))
        {
            var ipAttempts = GetOrCreateList(_ipSendHistory, ipAddress);
            
            lock (ipAttempts)
            {   
                ipAttempts.RemoveAll(a => a < now.Subtract(IpWindow));
                
                if (ipAttempts.Count >= SmsRateLimitConfig.MaxSmsPerIpPerHour)
                {   
                    var retryAfter = ipAttempts.Min().Add(IpWindow).Subtract(now);
                    
                    logger.LogWarning(
                        "SMS IP rate limit: {IP} sent {Count} SMS in last hour",
                        ipAddress, ipAttempts.Count);
                    return Result.Failure(
                        $"Too many attempts. " +
                        $"Try again in {retryAfter.TotalSeconds:F0} seconds.", AppErrorCode.TooManyRequests);
                }
            }
        }

        // ====== Cooldown — minimum tid mellom SMS av samme type til samme nummer ======
        var cooldownBetweenSms = GetCooldown(smsType);
        
        if (_lastSentTimestamps.TryGetValue(smsTypeKey, out var lastAttempt))
        {
            var timeSince = now - lastAttempt;
            
            if (timeSince < cooldownBetweenSms)
            {
                var retryAfter = cooldownBetweenSms - timeSince;
                logger.LogWarning(
                    "SMS cooldown active: {Type} to {Phone} must wait {Seconds}s",
                    smsType, phoneNumber, retryAfter.TotalSeconds);
                return Result.Failure(
                    $"Too many attempts. Try again in {retryAfter.TotalSeconds:F0} seconds.",
                    AppErrorCode.TooManyRequests);
            }
        }
        
        // ====== Daglig grense per SMS-type og telefonnummer ======
        var maxPerDay = GetMaxPerDay(smsType);
        var dailyAttempts = GetOrCreateList(_dailySendHistory, smsTypeKey);

        lock (dailyAttempts)
        {
            dailyAttempts.RemoveAll(a => a < now.Subtract(DayWindow));

            if (dailyAttempts.Count >= maxPerDay)
            {
                var retryAfter = dailyAttempts.Min().Add(DayWindow).Subtract(now);
                logger.LogWarning(
                    "SMS daily limit: {Type} to {Phone} exceeded {Max}/day",
                    smsType, phoneNumber, maxPerDay);
                return Result.Failure(
                    $"Daily limit reached. Try again in {retryAfter.TotalHours:F1} hours.",
                    AppErrorCode.TooManyRequests);
            }
        }

        logger.LogInformation("SMS rate limit check passed: {Type} to {Phone}", smsType, phoneNumber);
        return Result.Success();
    }
    
    
    /// <inheritdoc />
    public void RegisterSmsSent(SmsType smsType, string phoneNumber, string? ipAddress = null)
    {
        if (string.IsNullOrEmpty(phoneNumber))
            throw new ArgumentException("Phone number cannot be null or empty", nameof(phoneNumber));

        var now = DateTime.UtcNow;
        var typeKey = GetTypeKey(smsType, phoneNumber);

        // ======== Daglig telling per type ========
        var dailyAttempts = GetOrCreateList(_dailySendHistory, typeKey);
        lock (dailyAttempts)
        {
            dailyAttempts.Add(now);
        }

        // ======== IP-telling — delt på tvers av typer ========
        if (!string.IsNullOrEmpty(ipAddress))
        {
            var ipAttempts = GetOrCreateList(_ipSendHistory, ipAddress);
            lock (ipAttempts)
            {
                ipAttempts.Add(now);
            }
        }

        // Cooldown per type
        _lastSentTimestamps.AddOrUpdate(typeKey, now, (_, _) => now);

        logger.LogInformation("SMS sent and registered: {Type} to {Phone}", smsType, phoneNumber);
    }

    
    /// <inheritdoc />
    public void ClearSmsAttempts(SmsType smsType, string phoneNumber)
    {
        if (string.IsNullOrEmpty(phoneNumber)) 
            return;
        
        var typeKey = GetTypeKey(smsType, phoneNumber);
        
        _lastSentTimestamps.TryRemove(typeKey, out _);

        logger.LogInformation("Cleared cooldown for {Type}: {Phone}", smsType, phoneNumber);
    }
    
    // ========================= Hjelpemetoder ========================
    
    /// <summary>
    /// Oppretter en SMS Key utifra type SMS og telefonnummer. Eks "Verification:+4712345678"
    /// </summary>
    private static string GetTypeKey(SmsType smsType, string phoneNumber)
        => $"{smsType}:{phoneNumber}";
    
    
    /// <summary>
    /// Henter ut antall minutter cooldown fra forrige SMS til riktig type
    /// </summary>
    private static TimeSpan GetCooldown(SmsType smsType) => smsType switch
    {
        SmsType.Verification => TimeSpan.FromMinutes(SmsRateLimitConfig.VerificationCooldownMinutes),
        _ => TimeSpan.FromMinutes(SmsRateLimitConfig.VerificationCooldownMinutes)
    };
    
    /// <summary>
    /// Henter max SMS som er lov til hver type per dag
    /// </summary>
    private static int GetMaxPerDay(SmsType smsType) => smsType switch
    {
        SmsType.Verification => SmsRateLimitConfig.MaxVerificationSmsPerDay,
        _ => SmsRateLimitConfig.MaxVerificationSmsPerDay
    };
    
    /// <summary>
    /// Henter/oppretter en thread-safe liste med tidspunkter.
    /// </summary>
    private static List<DateTime> GetOrCreateList(
        ConcurrentDictionary<string, Lazy<List<DateTime>>> dictionary, string key) =>
        dictionary
            .GetOrAdd(key, _ => new Lazy<List<DateTime>>(() => []))
            .Value;
    
    
    // ========================= Cleanup ========================
    
    /// <inheritdoc />
    public void PerformCleanup()
    {
        var now = DateTime.UtcNow;

        // Cleanup cooldowns
        var maxCooldown = TimeSpan.FromMinutes(SmsRateLimitConfig.VerificationCooldownMinutes);
        
        // Henter ut cooldowns som er utgått
        var expiredCooldowns = _lastSentTimestamps
            .Where(kvp => kvp.Value < now.Subtract(maxCooldown))
            .Select(kvp => kvp.Key)
            .ToList();
        
        // Prøver å fjerne hver enkelt cooldown
        foreach (var key in expiredCooldowns)
            _lastSentTimestamps.TryRemove(key, out _);
        
        var expiredDaily = CleanupTimedEntries(_dailySendHistory, now.Subtract(DayWindow));
        var expiredIp = CleanupTimedEntries(_ipSendHistory, now.Subtract(IpWindow));
        
        if (expiredCooldowns.Count > 0 || expiredDaily > 0 || expiredIp > 0)
        {
            logger.LogInformation(
                "SMS rate limit cleanup: {Cooldown} cooldowns, {Daily} daily, {Ip} IP entries",
                expiredCooldowns.Count, expiredDaily, expiredIp);
        }
    }
    
    private static int CleanupTimedEntries(ConcurrentDictionary<string, Lazy<List<DateTime>>> dictionary, 
        DateTime removeOlderThan) 
    {
        var removed = 0;
        var emptyKeys = new List<string>();

        foreach (var kvp in dictionary)
        {
            if (!kvp.Value.IsValueCreated) 
                continue;
            
            var attempts = kvp.Value.Value;
            lock (attempts)
            {
                var before = attempts.Count;
                attempts.RemoveAll(a => a < removeOlderThan);
                removed += before - attempts.Count;
                    
                if (attempts.Count == 0)
                    emptyKeys.Add(kvp.Key);
            }
        }
        
        foreach (var key in emptyKeys)
            dictionary.TryRemove(key, out _);

        return removed;
    }
    
}
