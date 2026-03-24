namespace AFBack.Configurations.Options;

/// <summary>
/// Statisk konfigurasjon for verifiseringskoder (epost, passord-reset, SMS).
/// Styrer utløpstid og forsøksbegrensning for alle kodetyper.
/// </summary>
public static class VerificationConfig
{
    // ===== FORSØKSBEGRENSNING =====
    // Maks antall feilede forsøk før koden låses — gjelder alle kodetyper
    public static readonly int MaxFailedAttempts = 5;
    
    // ===== E-POST VERIFISERING =====
    public static readonly int EmailCodeExpiryMinutes = 60;
    
    // ===== TELEFON VERIFISERING =====
    // Kortere enn epost fordi SMS er mindre sikkert (SIM-swap, SS7-angrep)
    public static readonly int PhoneCodeExpiryMinutes = 10;
    
    // ===== PASSORD RESET =====
    // Tidsvindu etter SMS-verifisering hvor brukeren kan sette nytt passord
    public static readonly int PasswordResetWindowMinutes = 10;
    
    // ===== SIKKERHETSVARSLING =====
    // Bruker har 24 t på rapportere mistenksomhandling
    public static readonly int SecurityAlertTokenExpiryHours = 24;
}
