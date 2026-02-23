using AFBack.Common.Results;
using AFBack.Features.FileHandling.Enums;

namespace AFBack.Features.FileHandling.Services;

public interface IStorageService
{
    /// <summary>
    /// Laster opp en kryptert fil-stream til storage.
    /// Returnerer storage key som kan brukes til å hente filen senere.
    /// </summary>
    /// <param name="stream">Filen vi laster opp til Blob</param>
    /// <param name="storageKey">Stien/nanvet på filen i containeren. Eks messages/42/1337/a8f3b2c1.enc</param>
    /// <param name="container">Ønsket container å legge filene i</param>
    /// <param name="contentType">ContentType: bilde, video, etc</param>
    /// <param name="metadata">Optional key, value som lagres i Azure</param>
    /// <param name="ct">CT</param>
    /// <returns>Returnerer URL-en, selvom den brukes eller ikke</returns>
    Task<Result<string>> UploadAsync(Stream stream, string storageKey, string contentType,
        BlobContainer container, Dictionary<string, string>? metadata = null, CancellationToken ct = default);

    /// <summary>
    /// Laster ned en fil som stream direkte fra storage.
    /// Brukes som fallback — foretrekk GenerateDownloadUrlAsync for klienter.
    /// </summary>
    /// <param name="storageKey">Stien/nanvet på filen i containeren. Eks messages/42/1337/a8f3b2c1.enc</param>
    /// <param name="container">Ønsket container å legge filene i</param>
    /// <param name="ct"></param>
    /// <returns>Filen som en stream</returns>
    Task<Result<Stream>> DownloadAsync(string storageKey, BlobContainer container, CancellationToken ct = default);

    /// <summary>
    /// Genererer en tidsbegrenset URL som klienten kan bruke til å laste ned filen direkte.
    /// Filen er E2E-kryptert, så URL-en alene gir ingen tilgang til klartekst.
    /// </summary>
    /// <param name="storageKey">Stien/nanvet på filen i containeren. Eks messages/42/1337/a8f3b2c1.enc</param>
    /// <param name="container">Ønsket container å legge filene i</param>
    /// <param name="ct">CT</param>
    /// <returns>En SAS URL</returns>
    Task<Result<string>> GenerateDownloadUrlAsync(string storageKey, BlobContainer container,
        CancellationToken ct = default);

    /// <summary>
    /// Sletter en fil fra storage.
    /// </summary>
    /// <param name="storageKey">Stien/nanvet på filen i containeren. Eks messages/42/1337/a8f3b2c1.enc</param>
    /// <param name="container">Ønsket container å legge filene i</param>
    /// <param name="ct">CT</param>
    /// <returns>Result med Success eller Failure</returns>
    Task<Result> DeleteAsync(string storageKey, BlobContainer container, CancellationToken ct = default);


    /// <summary>
    /// Sjekker om en fil eksisterer i storage.
    /// </summary>
    /// <param name="storageKey">Stien/nanvet på filen i containeren. Eks messages/42/1337/a8f3b2c1.enc</param>
    /// <param name="container">Ønsket container å legge filene i</param>
    /// <param name="ct">CT</param>
    /// <returns>Bool med true hvis filen eksisterer eller false</returns>
    Task<Result<bool>> ExistsAsync(string storageKey, BlobContainer container, CancellationToken ct = default);
}
