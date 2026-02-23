using AFBack.Common.Results;
using AFBack.Configurations.Options;
using AFBack.Features.FileHandling.Constants;
using AFBack.Features.FileHandling.Helpers;

namespace AFBack.Features.FileHandling.Validators;

public class FileValidator(ILogger<FileValidator> logger) : IFileValidator
{  
    
    /// <inheritdoc />
    public Result ValidateEncryptedFile(IFormFile file, long maxSizeInBytes)
    {
        // Validerer at filen ikke er tom
        var emptyResult = ValidateNotEmpty(file);
        if (emptyResult.IsFailure)
            return emptyResult;

        // Validerer størrelsen — det eneste backend kan sjekke på krypterte filer
        var sizeResult = ValidateSize(file, maxSizeInBytes);
        if (sizeResult.IsFailure)
            return sizeResult;

        // Ingen extension, content type eller magic bytes validering —
        // filen er kryptert og backend vet ingenting om innholdet
        return Result.Success();
    }
  
    /// <inheritdoc />
    public Result ValidateSupportAttachment(IFormFile file)
    {  
        // Validerer at filen ikke er tom
        var emptyResult = ValidateNotEmpty(file);
        if (emptyResult.IsFailure)
            return emptyResult;
      
        // Validerer størrelsen
        var sizeResult = ValidateSize(file, SupportTicketFileConfig.TicketMaxFileSizeBytes);
        if (sizeResult.IsFailure)
            return sizeResult;
      
        // Validerer at extension er med og at den er korrekt til filtypen
        var extensionResult = ValidateExtension(file, SupportTicketFileConfig.SupportTicketExtensions);
        if (extensionResult.IsFailure)
            return Result.Failure(extensionResult.Error);
      
        // Validerer content type med allowed ContentTypes
        var contentTypeResult = ValidateContentType(file, SupportTicketFileConfig.SupportTicketContentTypes);
        if (contentTypeResult.IsFailure)
            return contentTypeResult;
      
        // Validerer om vi skal sjekke Magic Byte utifra extension
        if (!FileConstants.ShouldSkipMagicByteValidation(extensionResult.Value!))
        {  
            // Validerer Magic Bytes
            var magicBytesResult = ValidateMagicBytes(file, extensionResult.Value!);
            if (magicBytesResult.IsFailure)
                return magicBytesResult;
        }
      
        return Result.Success();
    }
    
    /// <inheritdoc />
    public Result ValidateImage(IFormFile file)
    {  
        // Validerer at filen ikke er tom
        var emptyResult = ValidateNotEmpty(file);
        if (emptyResult.IsFailure)
            return emptyResult;
      
        // Validerer størrelsen
        var sizeResult = ValidateSize(file, ImageFileConfig.MaxSizeInBytes);
        if (sizeResult.IsFailure)
            return sizeResult;
      
        // Validerer at extension er med og at den er korrekt til filtypen
        var extensionResult = ValidateExtension(file, ImageFileConfig.AllowedExtensions);
        if (extensionResult.IsFailure)
            return Result.Failure(extensionResult.Error);
      
        // Validerer content type med allowed ContentTypes
        var contentTypeResult = ValidateContentType(file, ImageFileConfig.AllowedContentTypes);
        if (contentTypeResult.IsFailure)
            return contentTypeResult;
      
        // Validerer om vi skal sjekke Magic Byte utifra extension
        if (!FileConstants.ShouldSkipMagicByteValidation(extensionResult.Value!))
        {  
            // Validerer Magic Bytes
            var magicBytesResult = ValidateMagicBytes(file, extensionResult.Value!);
            if (magicBytesResult.IsFailure)
                return magicBytesResult;
        }
      
        return Result.Success();
    }
    
    // ===================== Gjenbrukbare valideringsmetoder =====================
  
    /// <summary>
    /// Validerer at en fil ikke er tom
    /// </summary>
    /// <param name="file">Filen som skal valideres</param>
    /// <returns>Result med Success hvis filen har innhold eller Failure hvis tom</returns>
    public Result ValidateNotEmpty(IFormFile file)
    {
        if (file.Length == 0)
        {
            logger.LogError("File is empty: {FileName}", file.FileName);
            return Result.Failure("No file provided or file is empty");
        }
        return Result.Success();
    }
  
    /// <summary>
    /// Sjekker at filen ikke overskrider maks størrelse
    /// </summary>
    /// <param name="file">Filen som skal valideres</param>
    /// <param name="maxSizeInBytes">FileConstant med Maks Filstørrelse</param>
    /// <returns>Result med Success eller Failure</returns>
    public Result ValidateSize(IFormFile file, long maxSizeInBytes)
    {
        if (file.Length > maxSizeInBytes)
        {
            var maxFormatted = FileHelper.FormatFileSize(maxSizeInBytes);
            var fileFormatted = FileHelper.FormatFileSize(file.Length);
            logger.LogError("File size {Size} exceeds max {Max}: {FileName}",
                fileFormatted, maxFormatted, file.FileName);
            return Result.Failure(
                $"File size ({fileFormatted}) exceeds maximum allowed size ({maxFormatted})");
        }
        return Result.Success();
    }


    /// <summary>
    /// Validerer og returnerer extension til en fil. Validerer med tillatte extensions fra FileConstants
    /// </summary>
    /// <param name="file">Filen som vi sjekker extension til</param>
    /// <param name="allowedExtensions">Tilatte extensions for denne typen fil</param>
    /// <returns>Result med extension som en string</returns>
    public Result<string> ValidateExtension(IFormFile file, HashSet<string> allowedExtensions)
    {
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
      
        if (string.IsNullOrEmpty(extension))
        {
            logger.LogError("File has no extension: {FileName}", file.FileName);
            return Result<string>.Failure("File has no extension");
        }
        if (!allowedExtensions.Contains(extension))
        {
            logger.LogError("Invalid extension {Extension}. Allowed: {Allowed}. File: {FileName}",
                extension, string.Join(", ", allowedExtensions), file.FileName);
            return Result<string>.Failure(
                $"File extension '{extension}' is not allowed. Allowed: {string.Join(", ", allowedExtensions)}");
        }
      
        return Result<string>.Success(extension);
    }
  
  
    /// <summary>
    /// Validerer Content Type til en fil ("application/x-msdownload", "image/jpeg" etc.)
    /// </summary>
    /// <param name="file">Filen som skal valideres</param>
    /// <param name="allowedContentTypes">Content Type som er lov for denne typen fil</param>
    /// <returns>Result med Success eller Failure</returns>
    public Result ValidateContentType(IFormFile file, HashSet<string> allowedContentTypes)
    {
        var contentType = file.ContentType.ToLowerInvariant();
      
        if (string.IsNullOrEmpty(contentType))
        {
            logger.LogError("File has no content type: {FileName}", file.FileName);
            return Result.Failure("File has no content type");
        }
      
        if (!allowedContentTypes.Contains(contentType))
        {
            logger.LogError("Invalid content type {ContentType}: {FileName}", contentType, file.FileName);
            return Result.Failure($"Content type '{contentType}' is not allowed");
        }
        return Result.Success();
    }
  
    /// <summary>
    /// Validerer Magic Bytes/filsignatur er de første bytene i en fil som identifiserer filtypen.
    /// Vi kan valdire at dette stemmer med filtypen vi forventer. Extensions kan alltid endres
    /// </summary>
    /// <param name="file">Filen vi skal validere</param>
    /// <param name="extension">Extension til filen</param>
    /// <returns>Result med success eller failure</returns>
    private Result ValidateMagicBytes(IFormFile file, string extension)
    {
        // Henter signaturen (kan være flere for en filtype)
        var signatures = FileConstants.GetSignatures(extension);
        if (signatures is null)
            return Result.Failure(
                $"File validation not supported for '{extension}'. Configuration error.");
      
        // Åpner og leser filen
        using var stream = file.OpenReadStream();
        var buffer = new byte[16]; // Oppretter en tom byte array med 16 plasser
        // Leser de første 16 bytene inn i bufferen
        var bytesRead = stream.Read(buffer, 0, buffer.Length);
      
        if (bytesRead == 0)
            return Result.Failure("Could not read file content");
      
        // Vi iterer igjennom alle signaturene og sjekker om signaturen stemmer med filen
        foreach (var signature in signatures)
        {
            // Hvis signaturen og antall leste bytes er korrekt OG buffer og signatur stemmer, så har vi validert riktig
            if (bytesRead >= signature.Length && FileConstants.SignatureMatches(buffer, signature))
                return Result.Success();
        }
      
        return Result.Failure(
            $"File content does not match expected format for '{extension}'. " +
            "The file may be corrupted or incorrectly named.");
    }
}

