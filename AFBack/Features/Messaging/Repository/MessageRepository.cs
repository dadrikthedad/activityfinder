using AFBack.Cache;
using AFBack.Data;
using AFBack.DTOs;
using AFBack.Features.Messaging.DTOs;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using AttachmentDto = AFBack.Features.Messaging.DTOs.AttachmentDto;

namespace AFBack.Features.Messaging.Repository;

public class MessageRepository(
    ApplicationDbContext context) : IMessageRepository
{
    // Se interface for summary
    public Task<bool> MessageExistsAsync(int messageId) =>
        context.Messages.AsNoTracking().AnyAsync(message => messageId == message.Id);
    
    // Se interface for summary
    public async Task<MessageDto?> GetMessageDtoAsync(int messageId) =>
        await context.Messages
            .AsNoTracking()
            .AsSplitQuery()
            .Where(m => m.Id == messageId)
            .Select(m => new MessageDto
            {
                Id = m.Id,
                SenderId = m.SenderId,
                EncryptedText = m.EncryptedText,
                KeyInfo = m.KeyInfo,
                IV = m.IV,
                Version = m.Version,
                SentAt = m.SentAt,
                ConversationId = m.ConversationId,
                IsDeleted = m.IsDeleted,
                ParentMessageId = m.ParentMessageId,
                ParentMessagePreview = m.ParentMessagePreview,
                IsSystemMessage = m.IsSystemMessage,
                ParentSenderId = m.ParentMessage != null ? m.ParentMessage.SenderId : null,

                Attachments = m.IsDeleted
                    ? new List<AttachmentDto>()
                    : m.Attachments.Select(att => new AttachmentDto
                        {
                            EncryptedFileUrl = att.EncryptedFileUrl,
                            FileType = att.FileType,
                            FileName = att.OriginalFileName,
                            FileSize = att.OriginalFileSize,
                            KeyInfo = JsonConvert.DeserializeObject<Dictionary<string, string>>(att.KeyInfo)
                                      ?? new Dictionary<string, string>(),
                            IV = att.IV,
                            Version = att.Version,
                            EncryptedThumbnailUrl = att.EncryptedThumbnailUrl,
                            ThumbnailKeyInfo = string.IsNullOrEmpty(att.ThumbnailKeyInfo)
                                ? null
                                : JsonConvert.DeserializeObject<Dictionary<string, string>>(att.ThumbnailKeyInfo),
                            ThumbnailIV = att.ThumbnailIV,
                            ThumbnailWidth = att.ThumbnailWidth,
                            ThumbnailHeight = att.ThumbnailHeight
                        })
                        .ToList(),

                Reactions = m.IsDeleted
                    ? new List<ReactionDto>()
                    : m.Reactions.Select(r => new ReactionDto
                        {
                            MessageId = r.MessageId,
                            Emoji = r.Emoji,
                            UserId = r.UserId
                        })
                        .ToList()
            })
            .SingleOrDefaultAsync();

    
    // Se interface for summary
    public async Task<Models.Message> SaveMessageAsync(Models.Message message)
    {
        context.Messages.Add(message);
        await context.SaveChangesAsync();
        return message;
    }
}
