namespace AFBack.Configurations.Options;

public static class UnverifiedUserConfig
{
    // Slett uverifiserte brukere etter 48 timer
    public static readonly int MaxUnverifiedAgeHours = 48;
    // Brukere som har verifisert e-post ELLER telefon, men ikke begge
    public const int MaxPartiallyVerifiedAgeHours = 168; // 7 dager
    // Kjør cleanup hver 6. time
    public static readonly int CleanupIntervalHours = 6;
    
}
