namespace AFBack.Configurations.Options;

/// <summary>
/// Statisk konfigurasjon for SMS rate limiting.
/// Strengere enn email fordi SMS koster penger og er mer utsatt for misbruk.
/// </summary>
public static class SmsRateLimitConfig
{
    // ===== SMS: VERIFICATION =====
    public static readonly int VerificationCooldownMinutes = 2;
    public static readonly int MaxVerificationSmsPerDay = 3;

    // ===== SMS: DELT =====
    // Tidsvindu for daglig grense
    public static readonly int SmsDayWindowHours = 24;
    // Maks SMS per IP per time — delt på tvers av alle typer
    public static readonly int MaxSmsPerIpPerHour = 5;
    // IP-vindu i minutter
    public static readonly int SmsIpWindowMinutes = 60;
    // Cleanup-intervall for gamle entries
    public static readonly int SmsCleanupIntervalMinutes = 30;
}
