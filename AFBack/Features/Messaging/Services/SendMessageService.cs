using AFBack.Cache;
using AFBack.Common;
using AFBack.Common.Results;
using AFBack.Features.MessageBroadcast.Interface;
using AFBack.Features.Messaging.DTOs;
using AFBack.Features.Messaging.DTOs.Request;
using AFBack.Features.Messaging.DTOs.Response;
using AFBack.Features.Messaging.Interface;
using AFBack.Features.Messaging.Repository;
using AFBack.Services;

namespace AFBack.Features.Messaging.Services;

public class SendMessageService(
    IMessageRepository messageRepository,
    ILogger<SendMessageService> logger,
    ISendMessageCache msgCache,
    ISendMessageValidator sendMessageValidator,
    ISendMessageFactory sendMessageFactory,
    ISendMessageResponseBuilder responseBuilder,
    IMessageBroadcastService messageBroadcastService,
    IFileService fileService)
    : ISendMessageService
{
    // Flyt: AppUser sender melding i en allerede opprettet samtale -> Melding sendes raskt
    // Flyt: AppUser skal sende melding til bruker. Trykker Send Message -> Validering: Trenger vi å sende
    // MEssageRequest?
    // Hvis ja, lag MessageRequest/GroupRequest -> Kall SendMessageAsync med meldingen
    // Hvis nei, godkjenn tidligere avslått eller pending Samtale -> Kall SendMessageAsync
    
    // TODO: Implimenter auto akseptering av pending eller rejected.
    // Må Skje før SendMessageAsync, vi må også sjekke GroupRequestStatus
    // TODO: SendMessageToPendingAsync
    // Sjekker at vi har approved samtalen eller vi er creator hvis det er gruppesamtale
    // ValidateAndThrow(
    //     participant.ConversationStatus != ConversationStatus.Accepted &&
    //     participant.ConversationStatus != ConversationStatus.Creator,
    //     "AppUser {UserId} cannot send messages in conversation {ConversationId}. Status is {Status}.",
    //     "You must approve the conversation to send messages.",
    //     appUser.Id, request.ConversationId, participant.ConversationStatus);
    
    // TODO: Legge oss i Participants i backend
    // TODO: Frontend må oppdatere participants samt der vi sender Melding/Sync/Notification/Signalr
    
    
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
                return Result<SendMessageResponse>.Failure(validationResult.Error, validationResult.ErrorType);
        }
        
        // Her lagrer vi dataen vi trenger fra UploadAttachmentsAsync hvis det er noen attachments
        List<UploadedAttachmentDto>? attachments = null;
        
        try
        {
            // Lagrer Attachments etter valideringen er gjort
            if (request.NumberOfAttachments > 0)
            {
                var uploadAttachmentsResult = await UploadAttachmentsAsync(request, userId);
                if (uploadAttachmentsResult.IsFailure)
                    return Result<SendMessageResponse>.Failure(uploadAttachmentsResult.Error, 
                        uploadAttachmentsResult.ErrorType);
                
                attachments = uploadAttachmentsResult.Value;
            }
            
            logger.LogDebug("Creating message to save to database {UserId}", userId);
            
            // Vi mapper til Message-objektet
            var encryptedMessage = sendMessageFactory.CreateMessageWithAttachments(request, userId, attachments);
        
            // Lagrer melding i databasen
            var savedMessage = await messageRepository.SaveMessageAsync(encryptedMessage);
            
            // Sender signalR og lager syncevents
            messageBroadcastService.QueueNewMessageBackgroundTasks(
                savedMessage.Id, request.ConversationId, userId);
            
            logger.LogInformation("User {UserId} successfully sent message with Id {MessageId} " +
                                   "to {ConversationId}", userId,
                savedMessage.Id, request.ConversationId);
            
            // Bygg response
            var response = responseBuilder.BuildResponse(savedMessage, attachments);
            
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
                var urls = attachments
                    .SelectMany(att => new[] { att.EncryptedFileUrl, att.EncryptedThumbnailUrl })
                    .Where(url => !string.IsNullOrEmpty(url))
                    .ToList();
                
                // Slettter filene
                await fileService.TryCleanupFilesAsync(urls, "SendMessageAsync", userId);

            }

            return Result<SendMessageResponse>.Failure("An unexpected error occurred",
                ErrorTypeEnum.InternalServerError);
        }
    }
    
    /// <summary>
    /// Her laster vi opp krypterte attachments som kommer fra SendMessageAsync
    /// </summary>
    /// <param name="request">SendMessageRequest</param>
    /// <param name="userId">Avsender</param>
    /// <returns>Liste med attachments</returns>
    private async Task<Result<List<UploadedAttachmentDto>>> UploadAttachmentsAsync(MessageRequest request, string userId)
    {
        // Liste med Attachments hvor vi slår sammen attachmentene med de nye urlene for lagring
        var attachments = new List<UploadedAttachmentDto>();
        // Liste med urlene tilfelle lagringen går galt så vi får slettet det
        var uploadedUrls = new List<string>();
            
        try
        {   
            // Itererer igjennom hvert vedlegg
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
                catch (FormatException) // Hvis noe går galt under konverteringen
                {
                    logger.LogWarning("User {UserId} sent invalid Base64 data for file: {Filename}",
                        userId, attachment.FileName);
                    
                    await fileService.TryCleanupFilesAsync(uploadedUrls, "UploadAttachmentsAsync", userId);

                    return Result<List<UploadedAttachmentDto>>.Failure(
                        $"Invalid file data for: {attachment.FileName}", ErrorTypeEnum.Validation);
                }

                // Valider file data
                if (encryptedBytes.Length == 0)
                {
                    logger.LogWarning(
                        "User {UserId} sent empty file data for: {FileName}",
                        userId, attachment.FileName);
    
                    await fileService.TryCleanupFilesAsync(uploadedUrls, "UploadAttachmentsAsync", userId);
    
                    return Result<List<UploadedAttachmentDto>>.Failure(
                        $"Empty file data for: {attachment.FileName}",
                        ErrorTypeEnum.Validation);
                }

                // Valider thumbnail data
                if (encryptedThumbnailBytes.Length == 0)
                {
                    logger.LogWarning(
                        "User {UserId} sent empty thumbnail data for: {FileName}",
                        userId, attachment.FileName);
    
                    await fileService.TryCleanupFilesAsync(uploadedUrls, "UploadAttachmentsAsync", userId);
    
                    return Result<List<UploadedAttachmentDto>>.Failure(
                        $"Empty thumbnail data for: {attachment.FileName}",
                        ErrorTypeEnum.Validation);
                }
                
                // Vi sjekker hvilken blob storage den skal lagres i
                var containerName = attachment.FileType.StartsWith("video/")
                    ? "encrypted-message-videos"
                    : "encrypted-message-attachments";

                // Vi lager et unikt navn for denne krypterte filen og thumbnailen
                var fileName = $"{Path.GetFileNameWithoutExtension(attachment.FileName)}_{Guid.NewGuid()}.enc";
                var thumbnailFileName =
                    $"thumb_{Path.GetFileNameWithoutExtension(attachment.FileName)}_{Guid.NewGuid()}.enc";

                // Vi laster opp filene
                var uploadUrl = await fileService.UploadEncryptedBytesAsync(
                    encryptedBytes, containerName, fileName);
                uploadedUrls.Add(uploadUrl);
                    
                var thumbnailUrl = await fileService.UploadEncryptedBytesAsync(encryptedThumbnailBytes,
                    "encrypted-thumbnails",
                    thumbnailFileName);
                uploadedUrls.Add(thumbnailUrl);

                logger.LogInformation("Attachment uploaded for file: {FileName} with thumbnail: " +
                                       "{ThumbnailFileName}", fileName, thumbnailFileName);

                // Returnerer attachmenten tilbake til SendMessageAsync for lagring
                attachments.Add(new UploadedAttachmentDto
                {
                    EncryptedFileUrl = uploadUrl,
                    // Thumbnail
                    EncryptedThumbnailUrl = thumbnailUrl,
                    AttachmentRequest = attachment
                });
            }
            return Result<List<UploadedAttachmentDto>>.Success(attachments);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, 
                "Unexpected error uploading attachments for user {UserId}. Cleaning up {Count} files",
                userId, uploadedUrls.Count);
            
            // Sjekker at det er noen som ha blitt lastet opp og prøver å rydde de opp
            await fileService.TryCleanupFilesAsync(uploadedUrls, "UploadAttachmentsAsync", userId);

            return Result<List<UploadedAttachmentDto>>.Failure("Failed to upload attachments. Please try again.",
                ErrorTypeEnum.InternalServerError);
        } 
    }
    
    // ======================================== System melding ========================================
    
    
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
        
        messageBroadcastService.QueueNewMessageBackgroundTasks(conversationId, savedSystemMessage.Id, null);
    }
}
