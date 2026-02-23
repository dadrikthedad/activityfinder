using AFBack.Data;
using AFBack.DTOs;
using AFBack.Features.Messaging.DTOs;
using AFBack.Features.Messaging.Models;
using AFBack.Models.Enums;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;

namespace AFBack.Features.Messaging.Repository;

public class MessageRepository(
    AppDbContext context) : IMessageRepository
{
    /// <inheritdoc/>
    public Task<bool> MessageExistsAsync(int messageId) =>
        context.Messages.AsNoTracking().AnyAsync(message => messageId == message.Id);
    
    /// <inheritdoc/>
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
                            EncryptedFileStorageKey = att.EncryptedFileStorageKey,
                            FileType = att.FileType,
                            FileName = att.OriginalFileName,
                            FileSize = att.OriginalFileSize,
                            KeyInfo = JsonConvert.DeserializeObject<Dictionary<string, string>>(att.KeyInfo)
                                      ?? new Dictionary<string, string>(),
                            IV = att.IV,
                            Version = att.Version,
                            EncryptedThumbnailStorageKey = att.EncryptedThumbnailStorageKey,
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

    
    /// <inheritdoc/>
    public async Task<Message> SaveMessageAsync(Message message)
    {
        context.Messages.Add(message);
        await context.SaveChangesAsync();
        return message;
    }
    
    /// <inheritdoc/>
    public async Task<List<MessageDto>> GetMessagesByConversationIdAsync(int conversationId, int page, int pageSize) =>
        await context.Messages
            .AsNoTracking()
            .AsSplitQuery()
            .Where(m => m.ConversationId == conversationId)
            .OrderByDescending(m => m.SentAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
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
                            EncryptedFileStorageKey = att.EncryptedFileStorageKey,
                            FileType = att.FileType,
                            FileName = att.OriginalFileName,
                            FileSize = att.OriginalFileSize,
                            KeyInfo = JsonConvert.DeserializeObject<Dictionary<string, string>>(att.KeyInfo)
                                      ?? new Dictionary<string, string>(),
                            IV = att.IV,
                            Version = att.Version,
                            EncryptedThumbnailStorageKey = att.EncryptedThumbnailStorageKey,
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
            .ToListAsync();
    
    /// <inheritdoc/>
    public async Task<int> GetMessageCountByConversationIdAsync(int conversationId) =>
        await context.Messages
            .CountAsync(m => m.ConversationId == conversationId);
    
    /// <inheritdoc/>
    public async Task<ConversationMessagesDto> GetMessagesWithValidationAsync(string userId, int conversationId, 
        int page, int pageSize)
    {
        // Henter valideringsdata og meldinger i én spørring
        // Bruker subqueries for å få alt i én database roundtrip
        var validationData = await context.Conversations
            .AsNoTracking()
            .Where(c => c.Id == conversationId)
            .Select(c => new
            {
                ConversationExists = true,
                ParticipantStatus = c.Participants
                    .Where(p => p.UserId == userId)
                    .Select(p => (ConversationStatus?)p.Status)
                    .FirstOrDefault(),
                TotalCount = c.Messages.Count(m => !m.IsDeleted)
            })
            .FirstOrDefaultAsync();
        
        // Hvis samtalen ikke eksisterer, returner tidlig
        if (validationData == null)
        {
            return new ConversationMessagesDto
            {
                ConversationExists = false,
                ParticipantStatus = null,
                Messages = [],
                TotalCount = 0
            };
        }
        
        // Hent meldinger kun hvis validering er OK (unngår unødvendig spørring)
        // Dette er fortsatt samme database connection/roundtrip pga connection pooling
        var messages = await context.Messages
            .AsNoTracking()
            .AsSplitQuery()
            .Where(m => m.ConversationId == conversationId && !m.IsDeleted)
            .OrderByDescending(m => m.SentAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
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
                IsDeleted = false, // Alltid false siden vi filtrerer bort slettede
                ParentMessageId = m.ParentMessageId,
                ParentMessagePreview = m.ParentMessagePreview,
                IsSystemMessage = m.IsSystemMessage,
                ParentSenderId = m.ParentMessage != null ? m.ParentMessage.SenderId : null,

                Attachments = m.Attachments.Select(att => new AttachmentDto
                {
                    EncryptedFileStorageKey = att.EncryptedFileStorageKey,
                    FileType = att.FileType,
                    FileName = att.OriginalFileName,
                    FileSize = att.OriginalFileSize,
                    KeyInfo = JsonConvert.DeserializeObject<Dictionary<string, string>>(att.KeyInfo)
                              ?? new Dictionary<string, string>(),
                    IV = att.IV,
                    Version = att.Version,
                    EncryptedThumbnailStorageKey = att.EncryptedThumbnailStorageKey,
                    ThumbnailKeyInfo = string.IsNullOrEmpty(att.ThumbnailKeyInfo)
                        ? null
                        : JsonConvert.DeserializeObject<Dictionary<string, string>>(att.ThumbnailKeyInfo),
                    ThumbnailIV = att.ThumbnailIV,
                    ThumbnailWidth = att.ThumbnailWidth,
                    ThumbnailHeight = att.ThumbnailHeight
                }).ToList(),

                Reactions = m.Reactions.Select(r => new ReactionDto
                {
                    MessageId = r.MessageId,
                    Emoji = r.Emoji,
                    UserId = r.UserId
                }).ToList()
            })
            .ToListAsync();
        
        return new ConversationMessagesDto
        {
            ConversationExists = true,
            ParticipantStatus = validationData.ParticipantStatus,
            Messages = messages,
            TotalCount = validationData.TotalCount
        };
    }
    
    /// <inheritdoc/>
    public async Task<Dictionary<int, List<MessageDto>>> GetMessagesForConversationsAsync(
        List<int> conversationIds, int messagesPerConversation)
    {
        if (conversationIds.Count == 0)
            return new Dictionary<int, List<MessageDto>>();
        
        // Henter alle meldinger for alle samtaler, ranked per samtale
        var messages = await context.Messages
            .AsNoTracking()
            .AsSplitQuery()
            .Where(m => conversationIds.Contains(m.ConversationId) && !m.IsDeleted)
            .OrderByDescending(m => m.SentAt)
            .Select(m => new
            {
                m.ConversationId,
                Dto = new MessageDto
                {
                    Id = m.Id,
                    SenderId = m.SenderId,
                    EncryptedText = m.EncryptedText,
                    KeyInfo = m.KeyInfo,
                    IV = m.IV,
                    Version = m.Version,
                    SentAt = m.SentAt,
                    ConversationId = m.ConversationId,
                    IsDeleted = false,
                    ParentMessageId = m.ParentMessageId,
                    ParentMessagePreview = m.ParentMessagePreview,
                    IsSystemMessage = m.IsSystemMessage,
                    ParentSenderId = m.ParentMessage != null ? m.ParentMessage.SenderId : null,

                    Attachments = m.Attachments.Select(att => new AttachmentDto
                    {
                        EncryptedFileStorageKey = att.EncryptedFileStorageKey,
                        FileType = att.FileType,
                        FileName = att.OriginalFileName,
                        FileSize = att.OriginalFileSize,
                        KeyInfo = JsonConvert.DeserializeObject<Dictionary<string, string>>(att.KeyInfo)
                                  ?? new Dictionary<string, string>(),
                        IV = att.IV,
                        Version = att.Version,
                        EncryptedThumbnailStorageKey = att.EncryptedThumbnailStorageKey,
                        ThumbnailKeyInfo = string.IsNullOrEmpty(att.ThumbnailKeyInfo)
                            ? null
                            : JsonConvert.DeserializeObject<Dictionary<string, string>>(att.ThumbnailKeyInfo),
                        ThumbnailIV = att.ThumbnailIV,
                        ThumbnailWidth = att.ThumbnailWidth,
                        ThumbnailHeight = att.ThumbnailHeight
                    }).ToList(),

                    Reactions = m.Reactions.Select(r => new ReactionDto
                    {
                        MessageId = r.MessageId,
                        Emoji = r.Emoji,
                        UserId = r.UserId
                    }).ToList()
                }
            })
            .ToListAsync();
        
        // Grupper og ta kun X per samtale
        return messages
            .GroupBy(m => m.ConversationId)
            .ToDictionary(
                g => g.Key,
                g => g.Take(messagesPerConversation).Select(x => x.Dto).ToList()
            );
    }
    
    /// <inheritdoc/>
    public async Task<Dictionary<int, List<MessageDto>>> GetMessagesForConversationsWithValidationAsync(
        string userId, List<int> conversationIds, int messagesPerConversation)
    {
        if (conversationIds.Count == 0)
            return new Dictionary<int, List<MessageDto>>();
        
        // Henter meldinger kun for samtaler der brukeren er akseptert deltaker
        // JOIN på ConversationParticipants gjør validering og filtrering i én spørring
        var messages = await context.Messages
            .AsNoTracking()
            .AsSplitQuery()
            .Where(m => conversationIds.Contains(m.ConversationId) 
                        && !m.IsDeleted
                        && m.Conversation.Participants.Any(p => 
                            p.UserId == userId && p.Status == ConversationStatus.Accepted))
            .OrderByDescending(m => m.SentAt)
            .Select(m => new
            {
                m.ConversationId,
                Dto = new MessageDto
                {
                    Id = m.Id,
                    SenderId = m.SenderId,
                    EncryptedText = m.EncryptedText,
                    KeyInfo = m.KeyInfo,
                    IV = m.IV,
                    Version = m.Version,
                    SentAt = m.SentAt,
                    ConversationId = m.ConversationId,
                    IsDeleted = false,
                    ParentMessageId = m.ParentMessageId,
                    ParentMessagePreview = m.ParentMessagePreview,
                    IsSystemMessage = m.IsSystemMessage,
                    ParentSenderId = m.ParentMessage != null ? m.ParentMessage.SenderId : null,

                    Attachments = m.Attachments.Select(att => new AttachmentDto
                    {
                        EncryptedFileStorageKey = att.EncryptedFileStorageKey,
                        FileType = att.FileType,
                        FileName = att.OriginalFileName,
                        FileSize = att.OriginalFileSize,
                        KeyInfo = JsonConvert.DeserializeObject<Dictionary<string, string>>(att.KeyInfo)
                                  ?? new Dictionary<string, string>(),
                        IV = att.IV,
                        Version = att.Version,
                        EncryptedThumbnailStorageKey = att.EncryptedThumbnailStorageKey,
                        ThumbnailKeyInfo = string.IsNullOrEmpty(att.ThumbnailKeyInfo)
                            ? null
                            : JsonConvert.DeserializeObject<Dictionary<string, string>>(att.ThumbnailKeyInfo),
                        ThumbnailIV = att.ThumbnailIV,
                        ThumbnailWidth = att.ThumbnailWidth,
                        ThumbnailHeight = att.ThumbnailHeight
                    }).ToList(),

                    Reactions = m.Reactions.Select(r => new ReactionDto
                    {
                        MessageId = r.MessageId,
                        Emoji = r.Emoji,
                        UserId = r.UserId
                    }).ToList()
                }
            })
            .ToListAsync();
        
        // Grupper og ta kun X per samtale
        return messages
            .GroupBy(m => m.ConversationId)
            .ToDictionary(
                g => g.Key,
                g => g.Take(messagesPerConversation).Select(x => x.Dto).ToList()
            );
    }
    
    /// <inheritdoc/>
    public async Task<AttachmentDownloadDto?> GetAttachmentKeysForDownloadAsync(string userId, int attachmentId)
        => await context.MessageAttachments
            .AsNoTracking()
            .Where(att => att.Id == attachmentId
                          && !att.Message.IsDeleted
                          && att.Message.Conversation.Participants
                              .Any(p => p.UserId == userId 
                                        && p.Status == ConversationStatus.Accepted))
            .Select(att => new AttachmentDownloadDto
            {
                EncryptedFileStorageKey = att.EncryptedFileStorageKey,
                EncryptedThumbnailStorageKey = att.EncryptedThumbnailStorageKey
            })
            .SingleOrDefaultAsync();
    
    
    /// <inheritdoc/>
    public async Task<Message?> GetMessageForDeletionAsync(string userId, int messageId) =>
        await context.Messages.FirstOrDefaultAsync(m => m.Id == messageId);
    
    /// <inheritdoc/>
    public async Task SaveChangesAsync() => await context.SaveChangesAsync();
}
