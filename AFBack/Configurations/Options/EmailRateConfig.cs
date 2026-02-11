namespace AFBack.Configurations.Options;

public class EmailRateConfig
{
    // ===== EMAIL: VERIFICATION =====
    public static readonly int VerificationCooldownMinutes = 2;
    public static readonly int MaxVerificationEmailsPerDay = 5;

    // ===== EMAIL: PASSWORD RESET =====
    public static readonly int PasswordResetCooldownMinutes = 2;
    public static readonly int MaxPasswordResetEmailsPerDay = 3;

    // ===== EMAIL: DELT =====
    // Tidsvindu for daglig grense (gjelder begge typer)
    public static readonly int EmailDayWindowHours = 24;
    // Maks emails per IP per time — delt på tvers av alle typer
    public static readonly int MaxEmailsPerIpPerHour = 10;
    // IP-vindu i minutter
    public static readonly int EmailIpWindowMinutes = 60;
    // Cleanup-intervall for gamle entries
    public static readonly int EmailCleanupIntervalMinutes = 30;
}
