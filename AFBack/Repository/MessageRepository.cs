using AFBack.Data;
using AFBack.DTOs;
using AFBack.Features.MessageBroadcast.DTO.cs;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;

namespace AFBack.Interface.Repository;

public class MessageRepository : IMessageRepository
{
    private readonly ApplicationDbContext _context;

    public MessageRepository(ApplicationDbContext context)
    {
        _context = context;
    }
    
    /// <summary>
    /// Gjør en rask sjekk om en melding eksisterer og returnere en bool
    /// </summary>
    /// <param name="messageId"></param>
    /// <returns>bool</returns>
    public Task<bool> MessageExists(int messageId) =>
        _context.Messages.AsNoTracking().AnyAsync(message => messageId == message.Id);
    
    /// <summary>
    /// Rask metode som henter  og mapper en melding og relaterte objekter.
    /// Sender, ParentSender, EncryptedAttachment og Reactions.
    /// </summary>
    /// <param name="messageId"></param>
    /// <returns>EncryptedMessageBroadcastResponse</returns>
    public async Task<EncryptedMessageBroadcastResponse?> GetAndMapMessageEncryptedMessage(int messageId) =>  // TODO: Endre fra EncryptedMessagebroadcast til generisk MessageDTO
        await _context.Messages
            .AsNoTracking()
            .AsSplitQuery()
            .Where(message => message.Id == messageId)
            .Select(message => new EncryptedMessageBroadcastResponse
            {
                Id = message.Id,
                SenderId = message.SenderId,
                EncryptedText = message.IsDeleted ? null : message.EncryptedText,
                KeyInfo = message.IsDeleted
                    ? new Dictionary<string, string>()
                    : JsonConvert.DeserializeObject<Dictionary<string, string>>(message.KeyInfo) ??
                      new Dictionary<string, string>(),
                IV = message.IsDeleted ? string.Empty : message.IV,
                Version = message.Version,
                SentAt = message.SentAt,
                ConversationId = message.ConversationId,
                IsDeleted = message.IsDeleted,
                ParentMessageId = message.IsDeleted ? null : message.ParentMessageId,
                ParentMessagePreview = message.IsDeleted ? null : message.ParentMessagePreview,
                IsSystemMessage = message.IsSystemMessage,

                Sender = message.Sender != null
                    ? new UserSummaryDTO
                    {
                        Id = message.Sender.Id,
                        FullName = message.Sender.FullName,
                        ProfileImageUrl = message.Sender.ProfileImageUrl,
                    }
                    : null,

                ParentSender = message.IsDeleted
                    ? null
                    : (message.ParentMessage != null && message.ParentMessage.Sender != null
                        ? new UserSummaryDTO
                        {
                            Id = message.ParentMessage.Sender.Id,
                            FullName = message.ParentMessage.Sender.FullName,
                            ProfileImageUrl = message.ParentMessage.Sender.ProfileImageUrl
                        }
                        : null),

                EncryptedAttachments = message.IsDeleted
                    ? new List<EncryptedAttachmentBroadcastResponse>()
                    : message.Attachments.Select(att => new EncryptedAttachmentBroadcastResponse
                    {
                        EncryptedFileUrl = att.EncryptedFileUrl,
                        FileType = att.FileType,
                        FileName = att.OriginalFileName,
                        FileSize = att.OriginalFileSize,
                        KeyInfo = JsonConvert.DeserializeObject<Dictionary<string, string>>(att.KeyInfo) ??
                                  new Dictionary<string, string>(),
                        IV = att.IV,
                        Version = att.Version
                    }).ToList(),

                Reactions = message.IsDeleted
                    ? new List<ReactionDTO>()
                    : message.Reactions
                        .Select(reaction => new ReactionDTO
                        {
                            MessageId = reaction.MessageId,
                            Emoji = reaction.Emoji,
                            UserId = reaction.UserId
                        }).ToList(),
            }).SingleOrDefaultAsync();
}