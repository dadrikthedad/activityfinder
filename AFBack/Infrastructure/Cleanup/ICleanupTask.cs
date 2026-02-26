namespace AFBack.Infrastructure.Cleanup;

/// <summary>
/// Kontrakt for periodiske oppryddingsoppgaver som kjøres i bakgrunnen.
/// Hver implementasjon definerer sitt eget intervall og forsinkelse, og orkestreres
/// av en BackgroundService (MaintenanceCleanupService) som kaller ExecuteAsync periodisk.
/// </summary>
public interface ICleanupTask
{
    /// <summary>
    /// Lesbart navn på oppgaven, brukes i logging for å identifisere hvilken task som kjører/feiler.
    /// </summary>
    string TaskName { get; }
    
    /// <summary>
    /// Hvor ofte oppgaven skal kjøres (f.eks. hver 24. time for token-cleanup).
    /// </summary>
    TimeSpan Interval { get; }
    
    /// <summary>
    /// Forsinkelse før første kjøring etter oppstart, slik at appen rekker å starte helt opp
    /// før tunge cleanup-operasjoner begynner.
    /// </summary>
    TimeSpan InitialDelay { get; }
    
    /// <summary>
    /// Utfører selve oppryddingen. Kalles periodisk av orkestreringstjenesten.
    /// </summary>
    Task ExecuteAsync(CancellationToken cancellationToken);
}
