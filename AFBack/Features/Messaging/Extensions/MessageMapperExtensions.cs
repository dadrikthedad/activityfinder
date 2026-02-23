using AFBack.Common.DTOs;
using AFBack.DTOs;
using AFBack.Features.FileHandling.Enums;
using AFBack.Features.FileHandling.Services;
using AFBack.Features.Messaging.DTOs;
using AFBack.Features.Messaging.DTOs.Request;
using AFBack.Features.Messaging.DTOs.Response;
using AFBack.Features.Messaging.Models;
using Newtonsoft.Json;

namespace AFBack.Features.Messaging.Extensions;

public static class MessageMapperExtensions
{
    /// <summary>
    /// Mapper en MessageDto (brukes internt for rask meldinghenting) til en MessageREponse til frontend
    /// </summary>
    /// <param name="messageDto">MessageDto med alle relevante egenskaper hentet fra databasen</param>
    /// <param name="users">En dictgionary med brukerId og UserSummaryDto sånn at vi mapper
    /// fra cache istedenfor fra databasen. Har med Sender og ParentSender</param>
    /// <param name="blobUrlBuilder">Brukes for å bygge URL-en fra STorageKey</param>
    /// <returns>Ferdig mappet MessageResponse</returns>
    public static MessageResponse ToResponse(this MessageDto messageDto,
        Dictionary<string, UserSummaryDto> users, IBlobUrlBuilder blobUrlBuilder) => new()
    {
        Id = messageDto.Id,
        SenderId = messageDto.SenderId,
        EncryptedText = messageDto.IsDeleted ? null : messageDto.EncryptedText,
        KeyInfo = messageDto.IsDeleted
            ? new Dictionary<string, string>()
            : JsonConvert.DeserializeObject<Dictionary<string, string>>(messageDto.KeyInfo)
              ?? new Dictionary<string, string>(),
        IV = messageDto.IsDeleted ? string.Empty : messageDto.IV,
        Version = messageDto.Version,
        SentAt = messageDto.SentAt,
        ConversationId = messageDto.ConversationId,
        IsDeleted = messageDto.IsDeleted,
        ParentMessageId = messageDto.IsDeleted ? null : messageDto.ParentMessageId,
        ParentMessagePreview = messageDto.IsDeleted ? null : messageDto.ParentMessagePreview,
        IsSystemMessage = messageDto.IsSystemMessage,

        // Fra cache
        Sender = messageDto.SenderId != null
            ? users.GetValueOrDefault(messageDto.SenderId)
            : null,
        ParentSender = messageDto.IsDeleted || messageDto.ParentSenderId == null
            ? null
            : users.GetValueOrDefault(messageDto.ParentSenderId),

        EncryptedAttachments = messageDto.Attachments.Select(a => new AttachmentResponse
        {
            EncryptedFileUrl = blobUrlBuilder.GetBlobUrl(a.EncryptedFileStorageKey, BlobContainer.EncryptedFiles),
            EncryptedThumbnailUrl = a.EncryptedThumbnailStorageKey != null
                ? blobUrlBuilder.GetBlobUrl(a.EncryptedThumbnailStorageKey, BlobContainer.EncryptedFiles)
                : null,
            FileType = a.FileType,
            FileName = a.FileName,
            FileSize = a.FileSize,
            KeyInfo = a.KeyInfo,
            IV = a.IV,
            Version = a.Version,
            ThumbnailKeyInfo = a.ThumbnailKeyInfo,
            ThumbnailIV = a.ThumbnailIV,
            ThumbnailWidth = a.ThumbnailWidth,
            ThumbnailHeight = a.ThumbnailHeight
        }).ToList(),
        Reactions = messageDto.Reactions
    };
    
    
    /// <summary>
    /// Mapper en MessageDto til en SendMessageResponse. Tar med OptimisticId til tilhørende fra til frontend,
    /// og gjør om StorageKey til riktig URL
    /// </summary>
    /// <param name="message">Message hentet rett fra databasen</param>
    /// <param name="attachmentsFromRequest">Requesten fra frontend</param>
    /// <param name="blobUrlBuilder">Bygger URL-en</param>
    /// <returns>Ferdig mappet SendMessageResponse</returns>
    public static SendMessageResponse ToSendMessageResponse(this Message message,
        List<UploadedAttachmentDto>? attachmentsFromRequest,
        IBlobUrlBuilder blobUrlBuilder) => new()
    {
            MessageId = message.Id,
            SentAt = message.SentAt,
            Attachments = message.Attachments.Select(a => new SendMessageAttachmentResponse
            {
                Id = a.Id,
                OptimisticId = attachmentsFromRequest?
                    .FirstOrDefault(afr => afr.EncryptedFileStorageKey == a.EncryptedFileStorageKey)
                    ?.AttachmentRequest.OptimisticId,
                FileUrl = a.ToFileUrl(blobUrlBuilder),
                ThumbnailUrl = a.ToThumbnailUrl(blobUrlBuilder),

            }).ToArray(),
        };
    
    /// <summary>
    /// Mapper en MessageRequest til et Message for opplastning til database
    /// </summary>
    /// <param name="request">MessageRequest f ra frontend</param>
    /// <param name="userId">Avsender</param>
    /// <param name="attachments">Opplastede attachments</param>
    /// <returns>Ferdig bygget Message med MessageAttachments for lagring</returns>
    public static Message ToMessage(this MessageRequest request, string userId,
        List<UploadedAttachmentDto>? attachments = null) => new()
    {
            SenderId = userId,
            EncryptedText = request.EncryptedText,
            KeyInfo = JsonConvert.SerializeObject(request.KeyInfo),
            IV = request.IV,
            Version = request.Version,
            ParentMessageId = request.ParentMessageId,
            ParentMessagePreview = request.ParentMessagePreview,
            ConversationId = request.ConversationId,
            Attachments = attachments?.Select(att => new MessageAttachment
            {
                EncryptedFileStorageKey = att.EncryptedFileStorageKey,
                FileType = att.AttachmentRequest.FileType,
                OriginalFileName = att.AttachmentRequest.FileName,
                OriginalFileSize = att.AttachmentRequest.FileSize,
                KeyInfo = JsonConvert.SerializeObject(att.AttachmentRequest.KeyInfo),
                IV = att.AttachmentRequest.IV,
                Version = att.AttachmentRequest.Version,
                EncryptedThumbnailStorageKey = att.EncryptedThumbnailStorageKey,
                ThumbnailKeyInfo = JsonConvert.SerializeObject(att.AttachmentRequest.ThumbnailKeyInfo),
                ThumbnailIV = att.AttachmentRequest.ThumbnailIV,
                ThumbnailWidth = att.AttachmentRequest.ThumbnailWidth,
                ThumbnailHeight = att.AttachmentRequest.ThumbnailHeight,
                CreatedAt = DateTime.UtcNow
            }).ToList() ?? []
        };
        
    
    
    
    /// <summary>
    /// Gjør om MessageAttachment sin EncryptedFileStorageKey til en URL, for mapping
    /// </summary>
    /// <param name="attachment">MessageAttachment som tar StorageKey fra</param>
    /// <param name="blobUrlBuilder">URL-builderen</param>
    /// <returns>Ferdig bygd URL-string</returns>
    public static string ToFileUrl(this MessageAttachment attachment, IBlobUrlBuilder blobUrlBuilder)
     => blobUrlBuilder.GetBlobUrl(attachment.EncryptedFileStorageKey, BlobContainer.EncryptedFiles);
    
    /// <summary>
    /// Gjør om MessageAttachment sin EncryptedThumbnailStorageKey til en URL, for mapping.
    /// Forblir null hvis den ikke finnes
    /// </summary>
    /// <param name="attachment">MessageAttachment som tar StorageKey fra</param>
    /// <param name="blobUrlBuilder">URL-builderen</param>
    /// <returns>Ferdig bygd URL-string</returns>
    public static string? ToThumbnailUrl(this MessageAttachment attachment, IBlobUrlBuilder blobUrlBuilder) =>
        attachment.EncryptedThumbnailStorageKey != null
            ? blobUrlBuilder.GetBlobUrl(attachment.EncryptedThumbnailStorageKey, BlobContainer.EncryptedFiles)
            : null;
    
}
