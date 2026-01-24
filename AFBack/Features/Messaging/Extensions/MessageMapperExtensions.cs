using AFBack.DTOs;
using AFBack.Features.Messaging.DTOs;
using AFBack.Features.Messaging.DTOs.Response;
using Newtonsoft.Json;

namespace AFBack.Features.Messaging.Extensions;

public static class MessageMapperExtensions
{
    public static MessageResponse ToResponse(this MessageDto messageDto,
        Dictionary<string, UserSummaryDto> users) => new()
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

        EncryptedAttachments = messageDto.Attachments,
        Reactions = messageDto.Reactions
    };
    
    public static MessageResponse ToResponse(this MessageDto messageDto,
        UserSummaryDto sender) => new()
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
        Sender = sender,
        ParentSender = null,

        EncryptedAttachments = messageDto.Attachments,
        Reactions = messageDto.Reactions
    };

}
