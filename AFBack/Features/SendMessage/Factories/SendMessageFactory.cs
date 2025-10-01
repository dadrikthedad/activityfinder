using AFBack.Features.SendMessage.DTOs;
using AFBack.Features.SendMessage.Interface;
using AFBack.Models;
using Newtonsoft.Json;

namespace AFBack.Features.SendMessage.Factories;

public class SendMessageFactory : ISendMessageFactory
{
    /// <summary>
    /// Hjelpemetode for å bestemme om vi skal kune kjøre CreateMessage eller CreateAttachments ogspå
    /// </summary>
    /// <param name="request"></param>
    /// <param name="userId"></param>
    /// <param name="attachments"></param>
    /// <returns></returns>
    public Message CreateMessageWithAttachments(
        SendMessageRequest request,
        int userId,
        List<UploadedAttachment>? attachments)
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
    public Message CreateMessage(SendMessageRequest request, int userId) => new Message
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
    public List<MessageAttachment> CreateAttachments(List<UploadedAttachment> attachments, Message message)
    {
        return attachments.Select(att => new MessageAttachment
        {
            Message = message,
            EncryptedFileUrl = att.EncryptedFileUrl,
            FileType = att.Attachment.FileType,
            OriginalFileName = att.Attachment.FileName,
            OriginalFileSize = att.Attachment.FileSize,
            KeyInfo = JsonConvert.SerializeObject(att.Attachment.KeyInfo),
            IV = att.Attachment.IV,
            Version = att.Attachment.Version,
            EncryptedThumbnailUrl = att.EncryptedThumbnailUrl,
            ThumbnailKeyInfo = JsonConvert.SerializeObject(att.Attachment.ThumbnailKeyInfo),
            ThumbnailIV = att.Attachment.ThumbnailIV,
            ThumbnailWidth = att.Attachment.ThumbnailWidth,
            ThumbnailHeight = att.Attachment.ThumbnailHeight,
            CreatedAt = DateTime.UtcNow
        }).ToList();
    }
}
