using System.Collections.Concurrent;

namespace AFBack.Services;

public class EmailRateLimitService : IDisposable
{
    private readonly ConcurrentDictionary<string, DateTime> _emailAttempts = new();
    private readonly ConcurrentDictionary<string, List<DateTime>> _dailyEmailAttempts = new();
    private readonly ILogger<EmailRateLimitService> _logger;
    private readonly Timer _cleanupTimer;
    private bool _disposed = false;

    // Konfiguration
    private static readonly TimeSpan EmailCooldown = TimeSpan.FromMinutes(5);
    private static readonly int MaxEmailsPerDay = 5;
    private static readonly TimeSpan DayWindow = TimeSpan.FromHours(24);

    public EmailRateLimitService(ILogger<EmailRateLimitService> logger)
    {
        _logger = logger;
        
        // Cleanup hver 30. minutt
        _cleanupTimer = new Timer(PerformCleanup, null, 
            TimeSpan.FromMinutes(30), TimeSpan.FromMinutes(30));
    }

    public Task<(bool IsAllowed, TimeSpan? RetryAfter)> CanSendVerificationEmailAsync(
        string emailAddress, string? ipAddress = null)
    {
        ThrowIfDisposed();
        
        if (string.IsNullOrEmpty(emailAddress))
            throw new ArgumentException("Email address cannot be null or empty", nameof(emailAddress));

        var now = DateTime.UtcNow;
        var emailKey = emailAddress.ToLowerInvariant();

        // Sjekk cooldown (5 minutter siden siste email til samme adresse)
        if (_emailAttempts.TryGetValue(emailKey, out var lastAttempt))
        {
            var timeSinceLastAttempt = now - lastAttempt;
            if (timeSinceLastAttempt < EmailCooldown)
            {
                var retryAfter = EmailCooldown - timeSinceLastAttempt;
                _logger.LogWarning("Email verification rate limit: {Email} must wait {Seconds} seconds", 
                    emailKey, retryAfter.TotalSeconds);
                return Task.FromResult((false, (TimeSpan?)retryAfter));
            }
        }

        // Sjekk daglig grense
        var dailyAttempts = _dailyEmailAttempts.GetOrAdd(emailKey, _ => new List<DateTime>());
        
        lock (dailyAttempts)
        {
            // Fjern gamle attempts (eldre enn 24 timer)
            var dayAgo = now.Subtract(DayWindow);
            dailyAttempts.RemoveAll(a => a < dayAgo);

            if (dailyAttempts.Count >= MaxEmailsPerDay)
            {
                // Beregn når det eldste forsøket faller ut
                var oldestAttempt = dailyAttempts.Min();
                var retryAfter = oldestAttempt.Add(DayWindow).Subtract(now);
                
                _logger.LogWarning("Email verification daily limit exceeded for {Email}. Retry after {Hours} hours", 
                    emailKey, retryAfter.TotalHours);
                return Task.FromResult((false, (TimeSpan?)retryAfter));
            }

            // IKKE registrer forsøk her! Det gjøres i RegisterVerificationEmailSent()
        }

        _logger.LogInformation("Email verification check passed for {Email}", emailKey);
        return Task.FromResult((true, (TimeSpan?)null));
    }

    public void RegisterVerificationEmailSent(string emailAddress)
    {
        ThrowIfDisposed();
        
        if (string.IsNullOrEmpty(emailAddress))
            throw new ArgumentException("Email address cannot be null or empty", nameof(emailAddress));

        var now = DateTime.UtcNow;
        var emailKey = emailAddress.ToLowerInvariant();

        // Registrer i daglig teller
        var dailyAttempts = _dailyEmailAttempts.GetOrAdd(emailKey, _ => new List<DateTime>());
        
        lock (dailyAttempts)
        {
            dailyAttempts.Add(now);
        }

        // Sett cooldown
        _emailAttempts.AddOrUpdate(emailKey, now, (_, _) => now);

        _logger.LogInformation("Email verification sent and registered for {Email}", emailKey);
    }

    public void ClearEmailAttempts(string emailAddress)
    {
        ThrowIfDisposed();
        
        if (string.IsNullOrEmpty(emailAddress)) return;
        
        var emailKey = emailAddress.ToLowerInvariant();
        
        // Fjern cooldown når email blir verifisert
        _emailAttempts.TryRemove(emailKey, out _);
        
        _logger.LogInformation("Cleared rate limit attempts for verified email {Email}", emailKey);
    }

    private void PerformCleanup(object? state)
    {
        try
        {
            var now = DateTime.UtcNow;
            var cooldownCutoff = now.Subtract(EmailCooldown);
            var dayCutoff = now.Subtract(DayWindow);
            
            // Cleanup cooldown entries
            var expiredCooldowns = _emailAttempts
                .Where(kvp => kvp.Value < cooldownCutoff)
                .Select(kvp => kvp.Key)
                .ToList();
            
            foreach (var key in expiredCooldowns)
            {
                _emailAttempts.TryRemove(key, out _);
            }

            // Cleanup daily attempts
            var expiredDaily = new List<string>();
            foreach (var kvp in _dailyEmailAttempts)
            {
                var attempts = kvp.Value;
                lock (attempts)
                {
                    attempts.RemoveAll(a => a < dayCutoff);
                    if (attempts.Count == 0)
                    {
                        expiredDaily.Add(kvp.Key);
                    }
                }
            }

            foreach (var key in expiredDaily)
            {
                _dailyEmailAttempts.TryRemove(key, out _);
            }

            if (expiredCooldowns.Count > 0 || expiredDaily.Count > 0)
            {
                _logger.LogInformation("Email rate limit cleanup: removed {CooldownCount} cooldown and {DailyCount} daily entries",
                    expiredCooldowns.Count, expiredDaily.Count);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during email rate limit cleanup");
        }
    }

    private void ThrowIfDisposed()
    {
        if (_disposed)
            throw new ObjectDisposedException(nameof(EmailRateLimitService));
    }

    public void Dispose()
    {
        if (!_disposed)
        {
            _cleanupTimer?.Dispose();
            _disposed = true;
        }
    }
}

// Extension methods for registering the service
public static class EmailRateLimitServiceExtensions
{
    public static IServiceCollection AddEmailRateLimit(this IServiceCollection services)
    {
        return services.AddSingleton<EmailRateLimitService>();
    }
}