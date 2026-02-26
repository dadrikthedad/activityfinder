using AFBack.Common.Results;
using AFBack.Features.FileHandling.Enums;
using AFBack.Features.Messaging.DTOs;
using AFBack.Features.Support.Models;

namespace AFBack.Features.FileHandling.Services;

public interface IFileOrchestrator
{
    /// <summary>
    /// Validerer og laster opp et bilde til public container.
    /// Brukes av profil- og gruppebilder.
    /// </summary>
    /// <param name="image">Image som en IFormFile</param>
    /// <param name="storageKey">Filstien/navnet til filen. F.eks: "profiles/{userId}/profileimage"</param>
    /// <param name="ct">CT</param>
    /// <returns>URL-en som en string</returns>
    Task<Result<string>> UploadPublicImageAsync(IFormFile image, string storageKey, CancellationToken ct = default);
    
    /// <summary>
    /// Validerer og laster opp en kryptert fil (attachment/thumbnail) til encrypted container.
    /// </summary>
    /// <param name="encryptedData">Krypterte bytes</param>
    /// <param name="storageKey">Storage key fra StorageKeys</param>
    /// <param name="maxSizeInBytes">Maks filstørrelse</param>
    /// <param name="ct">CT</param>
    Task<Result> UploadEncryptedFileAsync(byte[] encryptedData, string storageKey, long maxSizeInBytes, 
        CancellationToken ct = default);

    /// <summary>
    /// Validerer og laster opp et SupportAttachment til en private container.
    /// Brukes av SupportTicketService
    /// </summary>
    /// <param name="file">Filen som en file</param>
    /// <param name="ct"></param>
    /// <returns>Result med SupportAttachment</returns>
    Task<Result<SupportAttachment>> UploadSupportAttachmentAsync(IFormFile file,
        CancellationToken ct = default);
    
    /// <summary>
    /// Genererer tidsbegrensede SAS URLs for alle attachments i en liste.
    /// Erstatter storage keys med nedlastbare URLs.
    /// </summary>
    /// <param name="attachments">Liste med attachments som AttachmentDto</param>
    /// <param name="ct"></param>
    /// <returns></returns>
    Task<List<AttachmentResponse>> ResolveAttachmentUrlsAsync(List<AttachmentResponse> attachments, 
        CancellationToken ct = default);
    
    
    /// <summary>
    /// Sletter et offentlig bilde fra storage.
    /// Brukes når gruppebilder fjernes. 
    /// </summary>
    /// <param name="storageKey">Filstien/navnet til filen. F.eks: "conversation/{id}/groupimage"</param>
    /// <param name="ct">CT</param>
    /// <returns>Result med Success eller Failure</returns>
    Task<Result> DeletePublicImageAsync(string storageKey, CancellationToken ct = default);
    

    /// <summary>
    /// Sletter en liste med filer fra storage. DeleteAsync logger feil.
    /// Brukes for rollback ved feil under attachment-opplasting.
    /// </summary>
    /// <param name="storageKeys">Filen som har blitt lastet opp, som må slettes</param>
    /// <param name="container">BlobContainer enum med type container</param>
    /// <param name="ct"></param>
    Task TryCleanupFilesAsync(List<string> storageKeys, BlobContainer container, CancellationToken ct = default);
}
