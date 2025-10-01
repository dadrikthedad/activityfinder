using AFBack.Data;
using AFBack.Features.Cache.Interface;
using AFBack.Features.MessageBroadcast.Interface;
using AFBack.Features.SendMessage.DTOs;
using AFBack.Features.SendMessage.Interface;
using AFBack.Infrastructure.Services;
using AFBack.Infrastructure.Middleware;
using AFBack.Services;

namespace AFBack.Features.SendMessage.Services;

public class SendMessageService(
    ApplicationDbContext context,
    ILogger<SendMessageService> logger,
    ISendMessageCache msgCache,
    ISendMessageValidator sendMessageValidator,
    ISendMessageFactory sendMessageFactory,
    ISendMessageResponseBuilder responseBuilder,
    IMessageBroadcastService messageBroadcastService,
    IFileService fileService)
    : BaseService<SendMessageService>(logger), ISendMessageService
{
    // Flyt: User sender melding i en allerede opprettet samtale -> Melding sendes raskt
    // Flyt: User skal sende melding til bruker. Trykker Send Message -> Validering: Trenger vi å sende MEssageRequest?
    // Hvis ja, lag MessageRequest/GroupRequest -> Kall SendMessageAsync med meldingen
    // Hvis nei, godkjenn tidligere avslått eller pending Samtale -> Kall SendMessageAsync
    
    // TODO: Implimenter auto akseptering av pending eller rejected. Må Skje før SendMessageAsync, vi må også sjekke GroupRequestStatus
    // TODO: SendMessageToPendingAsync
    // Sjekker at vi har approved samtalen eller vi er creator hvis det er gruppesamtale
    // ValidateAndThrow(
    //     participant.ConversationStatus != ConversationStatus.Approved &&
    //     participant.ConversationStatus != ConversationStatus.Creator,
    //     "User {UserId} cannot send messages in conversation {ConversationId}. Status is {Status}.",
    //     "You must approve the conversation to send messages.",
    //     user.Id, request.ConversationId, participant.ConversationStatus);
    
    // TODO: Legge oss i Participants i backend
    // TODO: Frontend må oppdatere participants samt der vi sender Melding/Sync/Notification/Signalr
    
    /// <summary>
    /// Validerer og lagrer en melding i databasen, samt setter singalr og syncevent-opprettelse i kø etter rask response
    /// </summary>
    /// <param name="request"></param>
    /// <param name="userId"></param>
    /// <returns></returns>
    public async Task<SendMessageResponse> SendMessageAsync(SendMessageRequest request, int userId)
    {
        LogDebug("SendMessageService: Starting SendMessageAsync for userId {UserId}", userId);
        
        // Sjekker om vi trenger å gjøre valideringer eller om samtalen er i cache/CanSend for alltid oppdatert sending
        var canSend = await msgCache.CanUserSendAsync(userId, request.ConversationId);
        
        // Ikke i Cache/CanSend. FULL validering
        if (!canSend)
        {   
            LogDebug("SendMessageService: Cache miss for CanSend check, falling back to full validation for user {UserId}", userId);
            // Valideringer kjøres i ValidateSendMessageAsync
            await sendMessageValidator.ValidateSendMessageAsync(request, userId);
        }
        
        // Her lagrer vi dataen vi trenger fra UploadAttachment hvis det er noen attachments
        List<UploadedAttachment>? attachments = null;
        
        try
        {
                
            // Lagrer Attachments etter valideringen er gjort
            if (request.NumberOfAttachments > 0)
            {
                attachments = await UploadAttachment(request, userId);
            }
            
            LogDebug("SendMessageService: Creating message to save to database {UserId}", userId);
            // Vi mapper til Message-objektet
            var encryptedMessage = sendMessageFactory.CreateMessageWithAttachments(request, userId, attachments);
        
            // Legger til meldingen
            context.Messages.Add(encryptedMessage);
     
            // Lagre til databasen
            await context.SaveChangesAsync();

            // Sender signalR og lager syncevents
            messageBroadcastService.QueueNewMessageBackgroundTasks(encryptedMessage.Id, request.ConversationId, userId, encryptedMessage.SentAt);
        
            // Bygger Responsen og returner MessageId, SentAt og ConversationId TODO: Conversaiton skal bort senere
            return responseBuilder.BuildResponse(encryptedMessage, attachments);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to upload or save attachments for user {UserId}", userId);

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
            throw;
        }
    }
    
    /// <summary>
    /// Her laster vi opp krypterte attachments som kommer SendMessageAsync
    /// </summary>
    /// <param name="request"></param>
    /// <param name="userId"></param>
    /// <returns></returns>
    /// <exception cref="ValidationException"></exception>
    private async Task<List<UploadedAttachment>> UploadAttachment(SendMessageRequest request, int userId)
    {
        // Sjekker at det ikke er mer enn 10 attachments
        ValidateAndThrow(request.NumberOfAttachments > 10,
            "User {UserId} tried to send {NumberOfAttachments} Attachments", 
            "The limit is 10 attachments", 
            userId, request.NumberOfAttachments);
        
        // Liste med Attachments hvor vi slår sammen attachmentene med de nye urlene for lagring
        var attachments = new List<UploadedAttachment>();
        // Liste med urlene tilfelle lagringen går galt så vi får slettet det
        var uploadedUrls = new List<string>();
            
        try
        {   
            // Itererer igjennom hvert vedlegg
            foreach (var attachment in request.EncryptedAttachments!)
            {
                try
                {
                    // Konvereterer til binære bytes for å kunne lagre det i blobben
                    var encryptedBytes = Convert.FromBase64String(attachment.EncryptedFileData);
                    var encryptedThumbnailBytes = Convert.FromBase64String(attachment.EncryptedThumbnailData);

                    // Sjekker at det er noen bytes etter konverteringen
                    ValidateAndThrow(encryptedBytes.Length == 0,
                        "User {UserId} sent empty encrypted data for file: {FileName}",
                        $"Empty encrypted data for file: {attachment.FileName} after decoding",
                        userId, attachment.FileName);

                    // Sjekker at det er noen bytes etter konverteringen av thumbnail
                    ValidateAndThrow(encryptedThumbnailBytes.Length == 0,
                        "User {UserId} sent empty encrypted data for thumbnail for file: {FileName}",
                        $"Empty encrypted thumbnaildata for file: {attachment.FileName} after decoding",
                        userId, attachment.FileName);

                    // Vi sjekker hvilken blob storage den skal lagres i
                    var containerName = attachment.FileType.StartsWith("video/")
                        ? "encrypted-message-videos"
                        : "encrypted-message-attachments";

                    // Vi lager et unikt navn for denne krypterte filen og thumbnailen
                    var fileName = $"{Path.GetFileNameWithoutExtension(attachment.FileName)}_{Guid.NewGuid()}.enc";
                    var thumbnailFileName =
                        $"thumb_{Path.GetFileNameWithoutExtension(attachment.FileName)}_{Guid.NewGuid()}.enc";

                    // Vi laster opp filene
                    var uploadUrl = await fileService.UploadEncryptedBytesAsync(encryptedBytes, containerName, fileName);
                    uploadedUrls.Add(uploadUrl);
                    
                    var thumbnailUrl = await fileService.UploadEncryptedBytesAsync(encryptedThumbnailBytes,
                        "encrypted-thumbnails",
                        thumbnailFileName);
                    uploadedUrls.Add(thumbnailUrl);

                    _logger.LogInformation("Attachment uploaded for file: {FileName} with thumbnail: {ThumbnailFileName}",
                        fileName, thumbnailFileName);

                    // Returnerer attachmenten tilbake til SendMessageAsync for lagring
                    var mappedAttachment = new UploadedAttachment
                    {
                        EncryptedFileUrl = uploadUrl,
                        // Thumbnail
                        EncryptedThumbnailUrl = thumbnailUrl,
                        Attachment = attachment

                    };
                
                    attachments.Add(mappedAttachment);

                }
                // Trenger vi å catche flere feil? TODO:
                catch (FormatException)
                {
                    _logger.LogWarning("User {UserId} sent invalid Base64 data for file: {FileName}", userId,
                        attachment.FileName);
                    throw new ValidationException($"Invalid base64 data for file: {attachment.FileName}");
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to upload attachments, cleaning up {Count} files", uploadedUrls.Count);
            
            // Sjekker at det er noen som ha blitt lastet opp og prøver å rydde de opp
            await fileService.TryCleanupFilesAsync(uploadedUrls, "UploadAttachment", userId);

            throw;
        } 
        return attachments;
    }
}
