namespace AFBack.Configurations.Options;

public static class FileConfig
{
    /// <summary>
    /// Hvor lenge en SAS URL er gyldig i minutter. Klienten må laste ned filen innen denne tiden.
    /// </summary>
    public const int SasExpiryMinutes = 10;

    /// <summary>
    /// Klokke-buffer i minutter for delegation key start-tidspunkt.
    /// Negativt tall for å kompensere for klokke-skew mellom servere.
    /// </summary>
    public const int DelegationKeyDelayMinutes = -5;
    
    /// <summary>
    /// Maks størrelse for krypterte meldingsfiler (25 MB)
    /// </summary>
    public const long MaxSizeInBytes = 25 * 1024 * 1024;

    /// <summary>
    /// Content type for alle krypterte filer — backend vet ikke hva innholdet er
    /// </summary>
    public const string ContentType = "application/octet-stream";

    /// <summary>
    /// Storage key prefix for krypterte meldingsfiler
    /// </summary>
    public const string StorageKeyPrefix = "messages";
}
