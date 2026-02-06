using System.Collections.Concurrent;
using AFBack.Configurations.Options;

namespace AFBack.Services;

public class EmailRateLimitService : IDisposable
{
    private readonly ConcurrentDictionary<string, DateTime> _emailAttempts = new();
    private readonly ConcurrentDictionary<string, Lazy<List<DateTime>>> _dailyEmailAttempts = new();
    private readonly ConcurrentDictionary<string, Lazy<List<DateTime>>> _ipEmailAttempts = new();

    private readonly ILogger<EmailRateLimitService> _logger;
    private readonly Timer _cleanupTimer;
    private bool _disposed;

    private static readonly TimeSpan EmailCooldown = TimeSpan.FromMinutes(RateLimitConfig.EmailCooldownMinutes);
    private static readonly TimeSpan DayWindow = TimeSpan.FromHours(RateLimitConfig.EmailDayWindowHours);
    private static readonly TimeSpan IpWindow = TimeSpan.FromHours(1);

    public EmailRateLimitService(ILogger<EmailRateLimitService> logger)
    {
        _logger = logger;

        _cleanupTimer = new Timer(
            PerformCleanup, null,
            TimeSpan.FromMinutes(RateLimitConfig.EmailCleanupIntervalMinutes),
            TimeSpan.FromMinutes(RateLimitConfig.EmailCleanupIntervalMinutes));
    }

    /// <summary>
    /// Sjekker om en verifikasjons-email kan sendes.
    /// Sjekker tre nivåer: IP-grense → cooldown → daglig grense per adresse.
    /// </summary>
    public Task<(bool IsAllowed, TimeSpan? RetryAfter)> CanSendVerificationEmailAsync(
        string emailAddress, string? ipAddress = null)
    {
        ThrowIfDisposed();

        if (string.IsNullOrEmpty(emailAddress))
            throw new ArgumentException("Email address cannot be null or empty", nameof(emailAddress));

        var now = DateTime.UtcNow;
        var emailKey = emailAddress.ToLowerInvariant();

        // 1. IP-basert grense — stopper angrep med mange forskjellige email-adresser
        if (!string.IsNullOrEmpty(ipAddress))
        {
            var ipAttempts = GetOrCreateList(_ipEmailAttempts, ipAddress);

            lock (ipAttempts)
            {
                ipAttempts.RemoveAll(a => a < now.Subtract(IpWindow));

                if (ipAttempts.Count >= RateLimitConfig.MaxEmailsPerIpPerHour)
                {
                    var retryAfter = ipAttempts.Min().Add(IpWindow).Subtract(now);
                    _logger.LogWarning("Email IP rate limit: {IP} sent {Count} emails in last hour",
                        ipAddress, ipAttempts.Count);
                    return Task.FromResult((false, (TimeSpan?)retryAfter));
                }
            }
        }

        // 2. Cooldown — minimum tid mellom emails til samme adresse
        if (_emailAttempts.TryGetValue(emailKey, out var lastAttempt))
        {
            var timeSince = now - lastAttempt;
            if (timeSince < EmailCooldown)
            {
                var retryAfter = EmailCooldown - timeSince;
                _logger.LogWarning("Email cooldown active: {Email} must wait {Seconds}s",
                    emailKey, retryAfter.TotalSeconds);
                return Task.FromResult((false, (TimeSpan?)retryAfter));
            }
        }

        // 3. Daglig grense per email-adresse
        var dailyAttempts = GetOrCreateList(_dailyEmailAttempts, emailKey);

        lock (dailyAttempts)
        {
            dailyAttempts.RemoveAll(a => a < now.Subtract(DayWindow));

            if (dailyAttempts.Count >= RateLimitConfig.MaxEmailsPerDay)
            {
                var retryAfter = dailyAttempts.Min().Add(DayWindow).Subtract(now);
                _logger.LogWarning("Email daily limit: {Email} exceeded {Max} emails/day",
                    emailKey, RateLimitConfig.MaxEmailsPerDay);
                return Task.FromResult((false, (TimeSpan?)retryAfter));
            }
        }

        _logger.LogInformation("Email rate limit check passed for {Email}", emailKey);
        return Task.FromResult((true, (TimeSpan?)null));
    }

    /// <summary>
    /// Registrerer at en email faktisk ble sendt. Kall dette ETTER vellykket sending.
    /// </summary>
    public void RegisterVerificationEmailSent(string emailAddress, string? ipAddress = null)
    {
        ThrowIfDisposed();

        if (string.IsNullOrEmpty(emailAddress))
            throw new ArgumentException("Email address cannot be null or empty", nameof(emailAddress));

        var now = DateTime.UtcNow;
        var emailKey = emailAddress.ToLowerInvariant();

        var dailyAttempts = GetOrCreateList(_dailyEmailAttempts, emailKey);
        lock (dailyAttempts)
        {
            dailyAttempts.Add(now);
        }

        if (!string.IsNullOrEmpty(ipAddress))
        {
            var ipAttempts = GetOrCreateList(_ipEmailAttempts, ipAddress);
            lock (ipAttempts)
            {
                ipAttempts.Add(now);
            }
        }

        _emailAttempts.AddOrUpdate(emailKey, now, (_, _) => now);

        _logger.LogInformation("Email sent and registered for {Email}", emailKey);
    }

    /// <summary>
    /// Fjerner cooldown for en email-adresse (kall ved vellykket verifisering)
    /// </summary>
    public void ClearEmailAttempts(string emailAddress)
    {
        ThrowIfDisposed();

        if (string.IsNullOrEmpty(emailAddress)) return;

        var emailKey = emailAddress.ToLowerInvariant();
        _emailAttempts.TryRemove(emailKey, out _);

        _logger.LogInformation("Cleared cooldown for verified email {Email}", emailKey);
    }

    private static List<DateTime> GetOrCreateList(
        ConcurrentDictionary<string, Lazy<List<DateTime>>> dictionary, string key)
    {
        return dictionary
            .GetOrAdd(key, _ => new Lazy<List<DateTime>>(() => new List<DateTime>()))
            .Value;
    }

    private void PerformCleanup(object? state)
    {
        try
        {
            var now = DateTime.UtcNow;

            var expiredCooldowns = _emailAttempts
                .Where(kvp => kvp.Value < now.Subtract(EmailCooldown))
                .Select(kvp => kvp.Key)
                .ToList();

            foreach (var key in expiredCooldowns)
                _emailAttempts.TryRemove(key, out _);

            var expiredDaily = CleanupTimedEntries(_dailyEmailAttempts, now.Subtract(DayWindow));
            var expiredIp = CleanupTimedEntries(_ipEmailAttempts, now.Subtract(IpWindow));

            if (expiredCooldowns.Count > 0 || expiredDaily > 0 || expiredIp > 0)
            {
                _logger.LogInformation(
                    "Email rate limit cleanup: {Cooldown} cooldowns, {Daily} daily, {Ip} IP entries",
                    expiredCooldowns.Count, expiredDaily, expiredIp);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during email rate limit cleanup");
        }
    }

    private static int CleanupTimedEntries(
        ConcurrentDictionary<string, Lazy<List<DateTime>>> dictionary, DateTime cutoff)
    {
        var removed = 0;
        var emptyKeys = new List<string>();

        foreach (var kvp in dictionary)
        {
            if (!kvp.Value.IsValueCreated) continue;

            var attempts = kvp.Value.Value;
            lock (attempts)
            {
                var before = attempts.Count;
                attempts.RemoveAll(a => a < cutoff);
                removed += before - attempts.Count;

                if (attempts.Count == 0)
                    emptyKeys.Add(kvp.Key);
            }
        }

        foreach (var key in emptyKeys)
            dictionary.TryRemove(key, out _);

        return removed;
    }

    private void ThrowIfDisposed()
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
    }

    public void Dispose()
    {
        if (!_disposed)
        {
            _cleanupTimer.Dispose();
            _disposed = true;
        }
    }
}

public static class EmailRateLimitServiceExtensions
{
    public static IServiceCollection AddEmailRateLimit(this IServiceCollection services)
    {
        return services.AddSingleton<EmailRateLimitService>();
    }
}
