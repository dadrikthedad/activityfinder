using System.Collections.Concurrent;
using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Configurations.Options;
using AFBack.Infrastructure.Email.Enums;

namespace AFBack.Infrastructure.Security.Services;

public class EmailRateLimitService(ILogger<EmailRateLimitService> logger) : IEmailRateLimitService
{
    // ========================= In-Memory database ========================
    /// <summary>
    /// Siste tidspunkt en email ble sendt per type+adresse. Brukes til cooldown-sjekk.
    /// Key = "{EmailType}:{email}", Value = tidspunkt for siste sending.
    /// Gir raskere oppslag på kun cooldown
    /// </summary>
    private readonly ConcurrentDictionary<string, DateTime> _lastSentTimestamps = new();

    /// <summary>
    /// Alle sendetidspunkter innenfor dagvinduet per type+adresse.
    /// Key = "{EmailType}:{email}", Value = liste med tidspunkter.
    /// Brukes til daglig grense.
    /// </summary>
    private readonly ConcurrentDictionary<string, Lazy<List<DateTime>>> _dailySendHistory = new();

    /// <summary>
    /// Alle sendetidspunkter innenfor IP-vinduet — delt på tvers av email-typer.
    /// Key = IP-adresse, Value = liste med tidspunkter.
    /// Brukes til IP-grense.
    /// </summary>
    private readonly ConcurrentDictionary<string, Lazy<List<DateTime>>> _ipSendHistory = new();

    
    // ========================= Henter settings som TimeSpan (24.00.00) ========================
    private static readonly TimeSpan DayWindow = TimeSpan.FromHours(EmailRateConfig.EmailDayWindowHours);
    private static readonly TimeSpan IpWindow = TimeSpan.FromMinutes(EmailRateConfig.EmailIpWindowMinutes);
    
    // ========================= Service metoder ========================
    
    /// <inheritdoc />
    public Result CanSendEmail(EmailType emailType, string emailAddress, string? ipAddress = null)
    {
        if (string.IsNullOrEmpty(emailAddress))
            throw new ArgumentException("Email address cannot be null or empty", nameof(emailAddress));

        var now = DateTime.UtcNow;
        
        // Vi lager en key utifra type email og til hvilken epost. Eks "Verification:test@test.no"
        var emailTypeKey = GetTypeKey(emailType, emailAddress);

        // ====== IP-basert grense — delt på tvers av alle email-typer ======
        // Vi sjekker at Ip-en til brukeren har flere forsøk i tidsvinduet
        if (!string.IsNullOrEmpty(ipAddress))
        {
            // Henter alle tidligere forsøk brukeren har brukt i dette vinduet, eller oppretter en tom liste
            var ipAttempts = GetOrCreateList(_ipSendHistory, ipAddress);
            
            // Låser listen for andre threads til blokken er ferdig
            lock (ipAttempts)
            {   
                // Fjerner gamle timestamps som ikke gjelder for nåværende vinduet
                ipAttempts.RemoveAll(a => a < now.Subtract(IpWindow));
                
                // Sjekker om brukeren har brukt opp epostene sine
                if (ipAttempts.Count >= EmailRateConfig.MaxEmailsPerIpPerHour)
                {   
                    // Vi regner ut hvor mye tid før brukeren har lov til å sende en epost igjen
                    var retryAfter = ipAttempts.Min().Add(IpWindow).Subtract(now);
                    
                    logger.LogWarning(
                        "Email IP rate limit: {IP} sent {Count} emails in last hour",
                        ipAddress, ipAttempts.Count);
                    return Result.Failure(
                        $"Too many attempts. " +
                        $"Try again in {retryAfter.TotalSeconds:F0} seconds.", ErrorTypeEnum.TooManyRequests);
                }
            }
        }

        // ====== Cooldown — minimum tid mellom emails av samme type til samme adresse ======
        // Henter antall minutter før det er klart igjen
        var cooldownBetweenEmails = GetCooldown(emailType);
        
        // Prøver å hente ut siste verdi til denne epostnøkkelen
        if (_lastSentTimestamps.TryGetValue(emailTypeKey, out var lastAttempt))
        {
            // Regner ut hvor lenge siden forrige forsøk var
            var timeSince = now - lastAttempt;
            
            // Sjekker at forrige forsøk ikke er på cooldown
            if (timeSince < cooldownBetweenEmails)
            {
                // Regner ut tiden til brukeren kan prøve igjen
                var retryAfter = cooldownBetweenEmails - timeSince;
                logger.LogWarning(
                    "Email cooldown active: {Type} to {Email} must wait {Seconds}s",
                    emailType, emailAddress, retryAfter.TotalSeconds);
                return Result.Failure(
                    $"Too many attempts. Try again in {retryAfter.TotalSeconds:F0} seconds.",
                    ErrorTypeEnum.TooManyRequests);
            }
        }
        
        // ====== Daglig grense per email-type og adresse ======
        var maxPerDay = GetMaxPerDay(emailType);
        var dailyAttempts = GetOrCreateList(_dailySendHistory, emailTypeKey);

        lock (dailyAttempts)
        {
            dailyAttempts.RemoveAll(a => a < now.Subtract(DayWindow));

            if (dailyAttempts.Count >= maxPerDay)
            {
                var retryAfter = dailyAttempts.Min().Add(DayWindow).Subtract(now);
                logger.LogWarning(
                    "Email daily limit: {Type} to {Email} exceeded {Max}/day",
                    emailType, emailAddress, maxPerDay);
                return Result.Failure(
                    $"Daily limit reached. Try again in {retryAfter.TotalHours:F1} hours.",
                    ErrorTypeEnum.TooManyRequests);
            }
        }

        logger.LogInformation("Email rate limit check passed: {Type} to {Email}", emailType, emailAddress);
        return Result.Success();
    }
    
    /// <inheritdoc />
    public void RegisterEmailSent(EmailType emailType, string emailAddress, string? ipAddress = null)
    {
        if (string.IsNullOrEmpty(emailAddress))
            throw new ArgumentException("Email address cannot be null or empty", nameof(emailAddress));

        var now = DateTime.UtcNow;
        // Henter epost nøkkelen
        var typeKey = GetTypeKey(emailType, emailAddress);

        // ======== Daglig telling per type ========
        // Oppretter eller henter listen fra ordboken for denne brukerne
        var dailyAttempts = GetOrCreateList(_dailySendHistory, typeKey);
        lock (dailyAttempts)
        {
            dailyAttempts.Add(now);
        }

        // ======== IP-telling — delt på tvers av typer ========
        // Oppretter eller henter listen fra ordboken for denne IP-en
        if (!string.IsNullOrEmpty(ipAddress))
        {
            var ipAttempts = GetOrCreateList(_ipSendHistory, ipAddress);
            lock (ipAttempts)
            {
                ipAttempts.Add(now);
            }
        }

        // Cooldown per type - Legger til denne på brukeren
        _lastSentTimestamps.AddOrUpdate(typeKey, now, (_, _) => now);

        logger.LogInformation("Email sent and registered: {Type} to {Email}", emailType, emailAddress);
    }

    
    
    /// <inheritdoc />
    public void ClearEmailAttempts(EmailType emailType, string emailAddress)
    {
        if (string.IsNullOrEmpty(emailAddress)) 
            return;
        
        // Henter nøkkelen til eposten
        var typeKey = GetTypeKey(emailType, emailAddress);
        
        // Fjernes fra cooldown
        _lastSentTimestamps.TryRemove(typeKey, out _);

        logger.LogInformation("Cleared cooldown for {Type}: {Email}", emailType, emailAddress);
    }
    
    // ========================= Hjelpemetoder ========================
    
    /// <summary>
    /// Oppretter en email Key utifra type epost og epost adresse. Eks "Verification:test@test.no"
    /// </summary>
    /// <param name="emailType">E-post type: Verification eller Forgotton Password</param>
    /// <param name="emailAddress">E-posten til brukerne</param>
    /// <returns>En ferdig nøkkel</returns>
    private static string GetTypeKey(EmailType emailType, string emailAddress)
        => $"{emailType}:{emailAddress.ToLowerInvariant()}";
    
    
    /// <summary>
    /// Henter ut antall minuter cooldown fra forrige epost til riktig type
    /// </summary>
    /// <param name="emailType">Type email</param>
    /// <returns>TimeSpan med antall minutter cooldown</returns>
    private static TimeSpan GetCooldown(EmailType emailType) => emailType switch
    {
        EmailType.Verification => TimeSpan.FromMinutes(EmailRateConfig.VerificationCooldownMinutes),
        EmailType.PasswordReset => TimeSpan.FromMinutes(EmailRateConfig.PasswordResetCooldownMinutes),
        _ => TimeSpan.FromMinutes(EmailRateConfig.VerificationCooldownMinutes)
    };
    
    /// <summary>
    /// Henter max e-poster som er lov til hver type per dag
    /// </summary>
    /// <param name="emailType">Type email</param>
    /// <returns>Int med max antall eposter pr dag</returns>
    private static int GetMaxPerDay(EmailType emailType) => emailType switch
    {
        EmailType.Verification => EmailRateConfig.MaxVerificationEmailsPerDay,
        EmailType.PasswordReset => EmailRateConfig.MaxPasswordResetEmailsPerDay,
        _ => EmailRateConfig.MaxVerificationEmailsPerDay
    };
    
    /// <summary>
    /// En metode som henter/oppretter en thread-safe ConcurrentDictionary med
    /// Key = emailKey, Value = Liste med tider brukeren har bedt om eposter som DateTime.
    /// Hvis nøkkelen ikke finnes, så opprettes det en ny tom liste, finnes et objekt så returnerer vi listen
    /// Brukes til å både til både _dailyEmailAttempts og _ipEmailAttempts
    /// </summary>
    /// <param name="dictionary">Ordboken vi legger til (enten _dailyEmailAttempts/_ipEmailAttempt) </param>
    /// <param name="key">Epost-nøkkelen</param>
    /// <returns>List med timestamps for denne brukeren</returns>
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

        // Cleanup cooldowns — velger lengste cooldownen for sikkerhetsskyld
        var maxCooldown = TimeSpan.FromMinutes(
            Math.Max(EmailRateConfig.VerificationCooldownMinutes,
                EmailRateConfig.PasswordResetCooldownMinutes));
        
        // Henter ut cooldowns som er utgått
        var expiredCooldowns = _lastSentTimestamps
            .Where(kvp => kvp.Value < now.Subtract(maxCooldown))
            .Select(kvp => kvp.Key)
            .ToList();
        
        // Prøver å fjerne hver enkelt cooldown
        foreach (var key in expiredCooldowns)
            _lastSentTimestamps.TryRemove(key, out _);
        
        // Ryyder opp i de andre ordbøkene
        var expiredDaily = CleanupTimedEntries(_dailySendHistory, now.Subtract(DayWindow));
        var expiredIp = CleanupTimedEntries(_ipSendHistory, now.Subtract(IpWindow));
        
        // Logger hvis noen var ryddet opp
        if (expiredCooldowns.Count > 0 || expiredDaily > 0 || expiredIp > 0)
        {
            logger.LogInformation(
                "Email rate limit cleanup: {Cooldown} cooldowns, {Daily} daily, {Ip} IP entries",
                expiredCooldowns.Count, expiredDaily, expiredIp);
        }
    }
    
    /// <summary>
    /// Rydder opp utgåtte verdier i en av ordbøkene for lagring
    /// </summary>
    /// <param name="dictionary">Ordbøken som skal få slettet objekter</param>
    /// <param name="removeOlderThan">Fjerner objektene med timestamps eldre enn dette</param>
    /// <returns>Antall oppryddede objekter</returns>
    private static int CleanupTimedEntries(ConcurrentDictionary<string, Lazy<List<DateTime>>> dictionary, 
        DateTime removeOlderThan) 
    {
        var removed = 0;
        var emptyKeys = new List<string>();

        foreach (var kvp in dictionary)
        {
            // early return hvis det ikke er noen verdier her
            if (!kvp.Value.IsValueCreated) 
                continue;
            
            // Fjerner kun verdiene som er utgått
            var attempts = kvp.Value.Value;
            lock (attempts)
            {
                var before = attempts.Count;
                attempts.RemoveAll(a => a < removeOlderThan);
                removed += before - attempts.Count;
                    
                // Hvis noe ble fjernet så lager vi nøkklene til å ryddes opp
                if (attempts.Count == 0)
                    emptyKeys.Add(kvp.Key);
            }
        }
        
        // Rydder opp alle nøkler med tomme verdier for å spare minne
        foreach (var key in emptyKeys)
            dictionary.TryRemove(key, out _);

        return removed;
    }
    
}
