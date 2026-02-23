// public class NotUsed
// {
//     // ====================== IKKE I BRUK - SLETTE? ========================
//     
//     /// <summary>
//     /// Genererer en fersk tidsbegrenset nedlastings-URL for et attachment.
//     /// Brukes når SAS URL er utløpt eller ved retry.
//     /// </summary>
//     [HttpGet("attachment/{attachmentId:int}/download")]
//     [ProducesResponseType(typeof(string), StatusCodes.Status200OK)]
//     [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
//     [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
//     [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
//     [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
//     public async Task<ActionResult<string>> GetAttachmentDownloadUrl(
//         [FromRoute]
//         [Required(ErrorMessage = "AttachmentId is required")]
//         [Range(1, int.MaxValue, ErrorMessage = "AttachmentId must be greater than 0")]
//         int attachmentId)
//     {
//         var userId = User.GetUserId();
//         var result = await messageQueryService.GetAttachmentDownloadUrlAsync(userId, attachmentId);
//
//         if (result.IsFailure)
//             return HandleFailure(result);
//
//         return Ok(result.Value);
//     }
//
//     /// <summary>
//     /// Genererer en fersk tidsbegrenset nedlastings-URL for et attachment sin thumbnail.
//     /// Brukes når SAS URL er utløpt eller ved retry.
//     /// </summary>
//     [HttpGet("attachment/{attachmentId:int}/thumbnail")]
//     [ProducesResponseType(typeof(string), StatusCodes.Status200OK)]
//     [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
//     [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
//     [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
//     [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
//     public async Task<ActionResult<string>> GetThumbnailDownloadUrl(
//         [FromRoute]
//         [Required(ErrorMessage = "AttachmentId is required")]
//         [Range(1, int.MaxValue, ErrorMessage = "AttachmentId must be greater than 0")]
//         int attachmentId)
//     {
//         var userId = User.GetUserId();
//         var result = await messageQueryService.GetThumbnailDownloadUrlAsync(userId, attachmentId);
//
//         if (result.IsFailure)
//             return HandleFailure(result);
//
//         return Ok(result.Value);
//     }
//     
//     public async Task<Result<FileUrlResponse>> GetAttachmentDownloadUrlAsync(string userId, int attachmentId)
//     {
//         // Henter attachment StorageKeys
//         var attachment = await messageRepository.GetAttachmentKeysForDownloadAsync(userId, attachmentId);
//         if (attachment == null)
//             return Result<FileUrlResponse>.Failure("Attachment not found", ErrorTypeEnum.NotFound);
//         
//         // Oppretter en SAS url
//         var urlResult = await fileOrchestrator.GenerateEncryptedFileDownloadUrlAsync(
//             attachment.EncryptedFileStorageKey);
//         if (urlResult.IsFailure)
//             return Result<FileUrlResponse>.Failure(urlResult.Error, urlResult.ErrorType);
//
//         return Result<FileUrlResponse>.Success(new FileUrlResponse { FileUrl = urlResult.Value!});
//     }
//
//     public async Task<Result<FileUrlResponse>> GetThumbnailDownloadUrlAsync(string userId, int attachmentId)
//     {
//         // Henter attachment StorageKeys
//         var attachment = await messageRepository.GetAttachmentKeysForDownloadAsync(userId, attachmentId);
//         if (attachment == null)
//             return Result<FileUrlResponse>.Failure("Attachment not found", ErrorTypeEnum.NotFound);
//         
//         // Ingen thumbnail key
//         if (string.IsNullOrEmpty(attachment.EncryptedThumbnailStorageKey))
//             return Result<FileUrlResponse>.Failure("Attachment has no thumbnail", ErrorTypeEnum.NotFound);
//         
//         // Oppretter en SAS url
//         var urlResult = await fileOrchestrator.GenerateEncryptedFileDownloadUrlAsync(
//             attachment.EncryptedThumbnailStorageKey);
//         if (urlResult.IsFailure)
//             return Result<FileUrlResponse>.Failure(urlResult.Error, urlResult.ErrorType);
//
//         return Result<FileUrlResponse>.Success(new FileUrlResponse { FileUrl = urlResult.Value!});
//     }
// }

// /// <summary>
// /// Genererer en fersk tidsbegrenset SAS URL for nedlasting av et attachment.
// /// Validerer at brukeren er deltaker i samtalen.
// /// </summary>
// /// <param name="userId">Bruker ID for å sikre at brukeren har tilattelse</param>
// /// <param name="attachmentId">ID-en til messageattachmenten vi skal ha URL for</param>
// /// <returns>En URL-string</returns>
// Task<Result<FileUrlResponse>> GetAttachmentDownloadUrlAsync(string userId, int attachmentId);
//
// /// <summary>
// /// Genererer en fersk tidsbegrenset SAS URL for nedlasting av et attachment sin thumbnail.
// /// Validerer at brukeren er deltaker i samtalen.
// /// </summary>
// /// <param name="userId">Bruker ID for å sikre at brukeren har tilattelse</param>
// /// <param name="attachmentId">ID-en til messageattachmenten vi skal ha thumbnail URL for</param>
// /// <returns>En URL-string</returns>
// Task<Result<FileUrlResponse>> GetThumbnailDownloadUrlAsync(string userId, int attachmentId);



//     
// /// <summary>
// /// Genererer en tidsbegrenset nedlastings-URL (SAS) for en kryptert fil.
// /// </summary>
// /// <param name="storageKey">Storage key lagret i databasen</param>
// /// <param name="ct">CT</param>
// /// <returns>Tidsbegrenset SAS URL</returns>
// Task<Result<string>> GenerateEncryptedFileDownloadUrlAsync(string storageKey, CancellationToken ct = default);

// /// <inheritdoc/>
// public async Task<Result<string>> GenerateEncryptedFileDownloadUrlAsync(string storageKey, 
//     CancellationToken ct = default) 
//     => await storageService.GenerateDownloadUrlAsync(storageKey, BlobContainer.EncryptedFiles, ct);
//     
//     
// // ======================== Delete ======================== 
// 
