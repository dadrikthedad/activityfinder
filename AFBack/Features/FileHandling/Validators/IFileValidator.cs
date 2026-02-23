using AFBack.Common.Results;

namespace AFBack.Features.FileHandling.Validators;

public interface IFileValidator
{
    /// <summary>
    /// Validerer en enkryptert fil. Sjekker at den ikke er tom og at størrelse er korrekt
    /// </summary>
    /// <param name="file">Fieln som skal valideres</param>
    /// <param name="maxSizeInBytes">Størrelsen i bytes</param>
    /// <returns>Result med Success eller Failure</returns>
    public Result ValidateEncryptedFile(IFormFile file, long maxSizeInBytes);


    /// <summary>
    /// Validerer en Support Ticket File (pdf, doc, txt eller bilde filer). Sjekker filstørrelse, extensions, content
    /// type og Magic Byte
    /// </summary>
    /// <param name="file">Filen som skal valideres</param>
    /// <returns>Result med Success eller en feilmelding</returns>
    Result ValidateSupportAttachment(IFormFile file);
    
    /// <summary>
    /// Validerer en bilde-fil (.jpg, .jpeh, .png, .webp)
    /// Sjekker filstørrelse, extensions, contenttype og Magic Bytes
    /// </summary>
    /// <param name="file">Filen som skal valideres</param>
    /// <returns>Result med Success eller en feilmelding</returns>
    Result ValidateImage(IFormFile file);
}

