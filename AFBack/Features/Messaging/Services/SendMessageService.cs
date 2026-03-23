using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Configurations.Options;
using AFBack.Features.Broadcast.Services.Interfaces;
using AFBack.Features.FileHandling.Constants;
using AFBack.Features.FileHandling.Enums;
using AFBack.Features.FileHandling.Services;
using AFBack.Features.Messaging.DTOs;
using AFBack.Features.Messaging.DTOs.Request;
using AFBack.Features.Messaging.DTOs.Response;
using AFBack.Features.Messaging.Extensions;
using AFBack.Features.Messaging.Repository;
using AFBack.Features.Messaging.Validators;
using AFBack.Infrastructure.Cache;

namespace AFBack.Features.Messaging.Services;

public class SendMessageService(
    IMessageRepository messageRepository,
    ILogger<SendMessageService> logger,
    ICanSendCache msgCache,
    ISendMessageValidator sendMessageValidator,
    IBlobUrlBuilder blobUrlBuilder,
    IMessageBroadcastService messageBroadcastService,
    IFileOrchestrator fileOrchestrator)
    : ISendMessageService
{
    // Flyt: AppUser sender melding i en allerede opprettet samtale -> Melding sendes raskt
    // Flyt: AppUser skal sende melding til bruker. Trykker Send Message -> Validering: Trenger vi å sende
    // MEssageRequest?
    // Hvis ja, lag MessageRequest/GroupRequest -> Kall SendMessageAsync med meldingen
    // Hvis nei, godkjenn tidligere avslått eller pending Samtale -> Kall SendMessageAsync
    

    /// <inheritdoc/>
    public async Task<Result<SendMessageResponse>> SendMessageAsync(MessageRequest request, string userId)
    {
        logger.LogInformation("Sending message for user {UserId} to conversation {ConversationId}", userId,
            request.ConversationId);
        
        // Sjekker om vi trenger å gjøre valideringer eller om samtalen er i cache/CanSend for alltid oppdatert sending
        var canSend = await msgCache.CanUserSendAsync(userId, request.ConversationId);
        
        // Ikke i Cache/CanSend. FULL validering
        if (!canSend)
        {   
            logger.LogDebug("SendMessageService: Cache miss for CanSend check, " +
                     "falling back to full validation for appUser {UserId}", userId);
            
            // Valideringer kjøres i ValidateSendMessageAsync
            var validationResult = await sendMessageValidator.ValidateSendMessageAsync(userId, request);
            
            if(validationResult.IsFailure)
                return Result<SendMessageResponse>.Failure(validationResult.Error, validationResult.AppErrorType);
        }
        
        // Her lagrer vi dataen vi trenger fra UploadAttachmentsAsync hvis det er noen attachments
        List<UploadedAttachmentDto>? attachments = null;
        
        try
        {
            // Lagrer Attachments etter valideringen er gjort
            if (request.NumberOfAttachments > 0)
            {
                var uploadAttachmentsResult = await UploadAttachmentsAsync(request, userId, request.ConversationId);
                if (uploadAttachmentsResult.IsFailure)
                    return Result<SendMessageResponse>.Failure(uploadAttachmentsResult.Error, 
                        uploadAttachmentsResult.ErrorCode);
                
                attachments = uploadAttachmentsResult.Value;
            }
            
            logger.LogDebug("Creating message to save to database {UserId}", userId);
            
            // Vi mapper til Message-objektet
            var encryptedMessage = request.ToMessage(userId, attachments);
        
            // Lagrer melding i databasen
            var savedMessage = await messageRepository.SaveMessageAsync(encryptedMessage);
            
            // Sender signalR og lager syncevents
            messageBroadcastService.QueueNewMessageBackgroundTasks(savedMessage.Id, request.ConversationId, userId);
            
            logger.LogInformation("User {UserId} successfully sent message with Id {MessageId} " +
                                   "to {ConversationId}", userId, savedMessage.Id, request.ConversationId);
            
            // Bygg response
            var response = savedMessage.ToSendMessageResponse(attachments, blobUrlBuilder);
            
            return Result<SendMessageResponse>.Success(response);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, 
                "Unexpected error sending message for user {UserId} to conversation {ConversationId}",
                userId, request.ConversationId);

            if (attachments?.Count > 0)
            {
                // Henter ut urlene for å slette de allerede opplastede filene hvis noe gikk galt
                var storageKeys  = attachments
                    .SelectMany(att => new[] { att.EncryptedFileStorageKey,
                        att.EncryptedThumbnailStorageKey })
                    .Where(url => !string.IsNullOrEmpty(url))
                    .ToList();
                
                // Slettter filene
                await fileOrchestrator.TryCleanupFilesAsync(storageKeys, BlobContainer.EncryptedFiles);

            }

            return Result<SendMessageResponse>.Failure("An unexpected error occurred",
                AppErrorCode.InternalServerError);
        }
    }

    /// <summary>
    /// Her laster vi opp krypterte attachments som kommer fra SendMessageAsync
    /// </summary>
    /// <param name="request">SendMessageRequest</param>
    /// <param name="userId">Avsender</param>
    /// <param name="conversationId">Samtalen det gjelder, kun for StorageKey</param>
    /// <returns>Liste med attachments</returns>
    private async Task<Result<List<UploadedAttachmentDto>>> UploadAttachmentsAsync(MessageRequest request, 
        string userId, int conversationId)
    {
        // Liste med Attachments hvor vi slår sammen attachmentene med de nye urlene for lagring
        var attachments = new List<UploadedAttachmentDto>();
        // Liste med storagekeys tilfelle lagringen går galt så vi får slettet de
        var uploadedStorageKeys = new List<string>();
        var success = false;
            
        try
        {   
            foreach (var attachment in request.EncryptedAttachments!)
            {
                // Konvereterer til binære bytes for å kunne lagre det i blobben
                byte[] encryptedBytes;
                byte[] encryptedThumbnailBytes;
                try
                {
                    encryptedBytes = Convert.FromBase64String(attachment.EncryptedFileData);
                    encryptedThumbnailBytes = Convert.FromBase64String(attachment.EncryptedThumbnailData);
                }
                catch (FormatException) // Filopplastning feilet - rydd opp
                {
                    logger.LogWarning("User {UserId} sent invalid Base64 data for file: {Filename}",
                        userId, attachment.FileName);
                    return Result<List<UploadedAttachmentDto>>.Failure(
                        $"Invalid file data for: {attachment.FileName}", AppErrorCode.Validation);
                }

                // Generer storage keys
                var fileId = Guid.NewGuid();
                var thumbId = Guid.NewGuid();
                var fileKey = StorageKeys.MessageAttachment(conversationId, fileId);
                var thumbKey = StorageKeys.MessageThumbnail(conversationId, thumbId);
                
                // Last opp fil
                var maxFileSize = attachment.FileType.StartsWith("video/") 
                    ? EncryptedFileConfig.MaxVideoSizeBytes 
                    : EncryptedFileConfig.MaxFileSizeBytes;
                
                // Valdier og last opp fil
                var fileResult = await fileOrchestrator.UploadEncryptedFileAsync(encryptedBytes, 
                    fileKey, maxFileSize);
                if (fileResult.IsFailure)
                {
                    // Filopplastning feilet - rydd opp
                    return Result<List<UploadedAttachmentDto>>.Failure(fileResult.Error, fileResult.AppErrorType);
                }
                uploadedStorageKeys.Add(fileKey);
                
                // Last opp thumbnail
                var thumbResult = await fileOrchestrator.UploadEncryptedFileAsync(
                    encryptedThumbnailBytes, thumbKey, EncryptedFileConfig.MaxThumbnailSizeBytes);
                if (thumbResult.IsFailure)
                    return Result<List<UploadedAttachmentDto>>.Failure(thumbResult.Error, thumbResult.AppErrorType);
                
                uploadedStorageKeys.Add(thumbKey);
                
                attachments.Add(new UploadedAttachmentDto
                {
                    EncryptedFileStorageKey = fileKey,
                    EncryptedThumbnailStorageKey = thumbKey,
                    AttachmentRequest = attachment
                });
            }
            
            success = true;
            logger.LogInformation("{NumberOfAttachments} Attachment(s) uploaded successfully", attachments.Count);
            return Result<List<UploadedAttachmentDto>>.Success(attachments);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, 
                "Unexpected error uploading attachments for user {UserId}. Cleaning up {Count} files",
                userId, uploadedStorageKeys.Count);
            return Result<List<UploadedAttachmentDto>>.Failure(
                "Failed to upload attachments. Please try again.", AppErrorCode.InternalServerError);
        }
        finally
        {
            if (!success && uploadedStorageKeys.Count > 0)
                await fileOrchestrator.TryCleanupFilesAsync(uploadedStorageKeys, BlobContainer.EncryptedFiles);
        }
    }
    
    // ======================================== System melding ========================================

    /// <inheritdoc/>
    public async Task SendSystemMessageAsync(int conversationId, string messageText)
    {
        logger.LogInformation("Creating system message for conversation {ConversationId}: {MessageText}", 
            conversationId, messageText);
        
        // Oppretter en system melding
        var systemMessage = new Models.Message
        {
            ConversationId = conversationId,
            SenderId = null,
            EncryptedText = messageText,
            IsSystemMessage = true,
            SentAt = DateTime.UtcNow,
        };
        
        // Lagrer meldingen
        var savedSystemMessage = await messageRepository.SaveMessageAsync(systemMessage);
        
        logger.LogInformation("System message saved with ID: {MessageId}", savedSystemMessage.Id);

        messageBroadcastService.QueueNewMessageBackgroundTasks(savedSystemMessage.Id, conversationId, null);
    }
}
