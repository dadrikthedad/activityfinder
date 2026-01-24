using AFBack.Features.SendMessage.DTOs;
using AFBack.Models;

namespace AFBack.Tests.Helpers;

public static class SendMessageTestHelpers
{
    /// <summary>
    /// Creates a valid SendMessageRequest with all required fields set
    /// </summary>
    public static SendMessageRequest CreateValidRequest(
        int conversationId = 123,
        string? encryptedText = null,
        string? iv = null,
        Dictionary<string, string>? keyInfo = null,
        int? parentMessageId = null,
        string? parentMessagePreview = null,
        List<SendMessageAttachment>? encryptedAttachments = null,
        int version = 1)
    {
        return new SendMessageRequest
        {
            ConversationId = conversationId,
            EncryptedText = encryptedText ?? "encrypted-test-content",
            IV = iv ?? "dGVzdC1pdi12YWx1ZQ==",
            KeyInfo = keyInfo ?? new Dictionary<string, string>
            {
                { "recipientKey", "testEncryptedKey" }
            },
            Version = version,
            ParentMessageId = parentMessageId,
            ParentMessagePreview = parentMessagePreview,
            EncryptedAttachments = encryptedAttachments
        };
    }
    
    /// <summary>
    /// Creates a request with only attachments (no text)
    /// </summary>
    public static SendMessageRequest CreateAttachmentOnlyRequest(
        int conversationId = 123,
        string? iv = null)
    {
        return new SendMessageRequest
        {
            ConversationId = conversationId,
            IV = iv ?? "dGVzdC1pdi12YWx1ZQ==",
            KeyInfo = new Dictionary<string, string>
            {
                { "recipientKey", "testEncryptedKey" }
            },
            EncryptedText = null,
            EncryptedAttachments = new List<SendMessageAttachment>
            {
                CreateValidAttachment()
            }
        };
    }
    
    /// <summary>
    /// Creates a valid SendMessageAttachment with encrypted data
    /// </summary>
    public static SendMessageAttachment CreateValidAttachment(
        string? fileName = null,
        string? fileType = null,
        long fileSize = 1024,
        string? iv = null,
        Dictionary<string, string>? keyInfo = null,
        string? encryptedFileData = null,
        string? encryptedThumbnailData = null,
        string? thumbnailIV = null,
        Dictionary<string, string>? thumbnailKeyInfo = null,
        int? thumbnailWidth = null,
        int? thumbnailHeight = null,
        string? optimisticId = null)
    {
        return new SendMessageAttachment
        {
            FileName = fileName ?? "test-file.jpg",
            FileType = fileType ?? "image/jpeg",
            FileSize = fileSize,
            KeyInfo = keyInfo ?? new Dictionary<string, string>
            {
                { "recipientKey", "testEncryptedKey" }
            },
            IV = iv ?? "dGVzdC1hdHRhY2htZW50LWl2",
            Version = 1,
            // Base64 encoded dummy data (just "test" encoded)
            EncryptedFileData = encryptedFileData ?? "dGVzdA==",
            EncryptedThumbnailData = encryptedThumbnailData ?? "dGVzdA==",
            ThumbnailIV = thumbnailIV ?? "dGVzdC10aHVtYm5haWwtaXY=",
            ThumbnailKeyInfo = thumbnailKeyInfo ?? new Dictionary<string, string>
            {
                { "recipientKey", "testEncryptedThumbKey" }
            },
            ThumbnailWidth = thumbnailWidth ?? 200,
            ThumbnailHeight = thumbnailHeight ?? 150,
            OptimisticId = optimisticId
        };
    }
    
    /// <summary>
    /// Creates a test UploadedAttachment
    /// </summary>
    public static UploadedAttachment CreateUploadedAttachment(
        string? fileUrl = null,
        string? thumbnailUrl = null,
        SendMessageAttachment? attachment = null)
    {
        return new UploadedAttachment
        {
            EncryptedFileUrl = fileUrl ?? "https://storage/file.enc",
            EncryptedThumbnailUrl = thumbnailUrl ?? "https://storage/thumb.enc",
            Attachment = attachment ?? CreateValidAttachment()
        };
    }
    
    /// <summary>
    /// Creates a test Conversation with participants
    /// </summary>
    public static Conversation CreateTestConversation(
        int id = 123,
        bool isGroup = false,
        int creatorId = 1,
        string? groupName = null,
        string? groupImageUrl = null,
        bool isApproved = true,
        bool isDisbanded = false,
        params int[] participantUserIds)
    {
        return new Conversation
        {
            Id = id,
            IsGroup = isGroup,
            CreatorId = creatorId,
            GroupName = groupName,
            GroupImageUrl = groupImageUrl,
            IsApproved = isApproved,
            IsDisbanded = isDisbanded,
            Participants = participantUserIds
                .Select(userId => CreateConversationParticipant(
                    conversationId: id,
                    userId: userId,
                    status: ConversationStatus.Approved))
                .ToList()
        };
    }
    
    /// <summary>
    /// Creates a ConversationParticipant
    /// </summary>
    public static ConversationParticipant CreateConversationParticipant(
        int conversationId = 123,
        int userId = 456,
        ConversationStatus status = ConversationStatus.Approved,
        bool hasDeleted = false,
        DateTime? deletedAt = null)
    {
        return new ConversationParticipant
        {
            ConversationId = conversationId,
            UserId = userId,
            ConversationStatus = status,
            HasDeleted = hasDeleted,
            DeletedAt = deletedAt
        };
    }
    
    /// <summary>
    /// Creates a test Conversation with custom participants
    /// </summary>
    public static Conversation CreateTestConversationWithParticipants(
        int id,
        bool isGroup,
        params ConversationParticipant[] participants)
    {
        return new Conversation
        {
            Id = id,
            IsGroup = isGroup,
            CreatorId = participants.FirstOrDefault()?.UserId ?? 1,
            IsApproved = true,
            Participants = participants.ToList()
        };
    }
}