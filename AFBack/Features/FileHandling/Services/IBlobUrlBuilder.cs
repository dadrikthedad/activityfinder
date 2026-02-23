using AFBack.Features.FileHandling.Enums;

namespace AFBack.Features.FileHandling.Services;

public interface IBlobUrlBuilder
{
    /// <summary>
    /// Oppretter en blob URL utifra storageKey
    /// </summary>
    /// <param name="storageKey">Filstien til filen</param>
    /// <param name="container">Enum til type Containeren filen ligger i</param>
    /// <returns>En ferdig blob URL: https://{account}.blob.core.windows.net/{container}/{storageKey}</returns>
    string GetBlobUrl(string storageKey, BlobContainer container);
    
    /// <summary>
    /// Henter container navnet fra appSettings utifra ønsket container
    /// </summary>
    /// <param name="container">Enum til type container</param>
    /// <returns>Container navnet som string</returns>
    string GetContainerName(BlobContainer container);
}
