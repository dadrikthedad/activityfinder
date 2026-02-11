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
    
    // ===== PASSORD RESET =====
    public static readonly int PasswordResetCodeExpiryMinutes = 60;
    
    // ===== TELEFON VERIFISERING =====
    // Kortere enn epost fordi SMS er mindre sikkert (SIM-swap, SS7-angrep)
    public static readonly int PhoneCodeExpiryMinutes = 10;
}
