using AFBack.Features.Messaging.DTOs;
using AFBack.Features.Messaging.DTOs.Request;
using AFBack.Features.Messaging.Interface;
using AFBack.Features.Messaging.Models;
using Newtonsoft.Json;

namespace AFBack.Features.Messaging.Factories;

public class SendMessageFactory : ISendMessageFactory
{
    /// <summary>
    /// Hjelpemetode for å bestemme om vi skal kune kjøre CreateMessage eller CreateAttachments også
    /// </summary>
    /// <param name="request"></param>
    /// <param name="userId"></param>
    /// <param name="attachments"></param>
    /// <returns></returns>
    public Message CreateMessageWithAttachments(
        MessageRequest request,
        string userId,
        List<UploadedAttachmentDto>? attachments)
    {
        var message = CreateMessage(request, userId);

        if (attachments?.Any() == true)
        {
            message.Attachments = CreateAttachments(attachments, message);
        }

        return message;
    }
    
    /// <summary>
    /// Vi mapper til et Message objekt
    /// </summary>
    /// <param name="request"></param>
    /// <param name="userId"></param>
    /// <returns></returns>
    private Message CreateMessage(MessageRequest request, string userId) => new()
    {
        SenderId = userId,
        EncryptedText = request.EncryptedText,
        KeyInfo = JsonConvert.SerializeObject(request.KeyInfo),
        IV = request.IV,
        Version = request.Version,
        ParentMessageId = request.ParentMessageId,
        ParentMessagePreview = request.ParentMessagePreview,
        ConversationId = request.ConversationId,
    };
    
    /// <summary>
    /// Vi mapper attachmetns til message-objektet
    /// </summary>
    /// <param name="attachments"></param>
    /// <param name="message"></param>
    /// <returns></returns>
    private List<MessageAttachment> CreateAttachments(List<UploadedAttachmentDto> attachments, Models.Message message)
    {
        return attachments.Select(att => new MessageAttachment
        {
            Message = message,
            EncryptedFileUrl = att.EncryptedFileUrl,
            FileType = att.AttachmentRequest.FileType,
            OriginalFileName = att.AttachmentRequest.FileName,
            OriginalFileSize = att.AttachmentRequest.FileSize,
            KeyInfo = JsonConvert.SerializeObject(att.AttachmentRequest.KeyInfo),
            IV = att.AttachmentRequest.IV,
            Version = att.AttachmentRequest.Version,
            EncryptedThumbnailUrl = att.EncryptedThumbnailUrl,
            ThumbnailKeyInfo = JsonConvert.SerializeObject(att.AttachmentRequest.ThumbnailKeyInfo),
            ThumbnailIV = att.AttachmentRequest.ThumbnailIV,
            ThumbnailWidth = att.AttachmentRequest.ThumbnailWidth,
            ThumbnailHeight = att.AttachmentRequest.ThumbnailHeight,
            CreatedAt = DateTime.UtcNow
        }).ToList();
    }
}
