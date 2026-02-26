namespace AFBack.Configurations.Options;

/// <summary>
/// Konfigurasjon for SyncEvent-systemet.
/// Brukes av SyncService for å bestemme sync-oppførsel og av SyncEventsCleanupTask for opprydding.
/// </summary>
public static class SyncEventConfig
{
    /// <summary>
    /// Maks antall events før klienten må gjøre full bootstrap i stedet for inkrementell sync.
    /// </summary>
    public const int MaxEventThreshold = 30;

    /// <summary>
    /// Hvor lenge en enhet kan være inaktiv før den krever full bootstrap.
    /// Events eldre enn dette slettes av cleanup-tasken.
    /// </summary>
    public static readonly TimeSpan InactivityThreshold = TimeSpan.FromDays(7);

    /// <summary>
    /// Hvor ofte cleanup-tasken kjøres.
    /// </summary>
    public static readonly TimeSpan CleanupInterval = TimeSpan.FromHours(24);

    /// <summary>
    /// Forsinkelse før første cleanup etter oppstart.
    /// </summary>
    public static readonly TimeSpan CleanupInitialDelay = TimeSpan.FromMinutes(10);
}
