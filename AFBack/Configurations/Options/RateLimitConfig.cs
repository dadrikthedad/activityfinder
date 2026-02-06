namespace AFBack.Configurations.Options;

/// <summary>
/// Statisk konfigurasjon for rate limiting og email rate limiting.
/// Endres kun ved redeployment — dette er verdier som sjelden justeres.
/// </summary>
public static class RateLimitConfig
{
    // ===== GLOBAL =====
    // Sikkerhetsnett for alle endepunkter. Alle requests må igjennom denne.
    public static readonly int GlobalPermitLimit = 200;
    public static readonly int GlobalWindowMinutes = 1;
    public static readonly int GlobalSegmentsPerWindow = 4;
    public static readonly int GlobalQueueLimit = 5;

    // ===== AUTH =====
    // Login, register, email-verifisering. Strengt for sikkerhet.
    public static readonly int AuthPermitLimit = 8;
    public static readonly int AuthWindowMinutes = 5;
    public static readonly int AuthSegmentsPerWindow = 2;
    public static readonly int AuthQueueLimit = 0;

    // ===== MESSAGING =====
    // Chat-meldinger. Høyere kapasitet for normal bruk.
    public static readonly int MessagingPermitLimit = 100;
    public static readonly int MessagingWindowMinutes = 1;
    public static readonly int MessagingSegmentsPerWindow = 6;
    public static readonly int MessagingQueueLimit = 15;

    // ===== PUBLIC =====
    // Offentlige endepunkter. Generøse limits.
    public static readonly int PublicPermitLimit = 500;
    public static readonly int PublicWindowMinutes = 1;
    public static readonly int PublicSegmentsPerWindow = 4;
    public static readonly int PublicQueueLimit = 50;

    // ===== STRIKES =====
    // Antall rate limit violations før rapportering til IpBanService
    public static readonly int StrikesBeforeBan = 5;
    public static readonly int StrikeWindowMinutes = 10;

    // ===== EMAIL =====
    // Minimum tid mellom emails til samme adresse
    public static readonly int EmailCooldownMinutes = 5;
    // Maks emails per adresse per dag
    public static readonly int MaxEmailsPerDay = 5;
    // Tidsvindu for daglig grense
    public static readonly int EmailDayWindowHours = 24;
    // Maks emails per IP per time (beskytter mot kostnadsangrep)
    public static readonly int MaxEmailsPerIpPerHour = 10;
    // Cleanup-intervall for gamle entries
    public static readonly int EmailCleanupIntervalMinutes = 30;
}
