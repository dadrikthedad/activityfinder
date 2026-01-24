using FluentAssertions;
using AFBack.Features.SendMessage.DTOs;
using AFBack.Features.SendMessage.Factories;
using AFBack.Models;
using AFBack.Tests.Helpers;

namespace AFBack.Tests.Features.SendMessage.Factories;

public class SendMessageFactoryTests
{
    private readonly SendMessageFactory _factory = new();
    
    [Fact]
    public void CreateMessage_WithValidRequest_ShouldCreateCorrectMessage()
    {
        // Arrange
        var request = new SendMessageRequest
        {
            EncryptedText = "encrypted-message",
            ConversationId = 123,
            ParentMessageId = 456,
            ParentMessagePreview = "preview text",
            KeyInfo = new Dictionary<string, string> { { "key", "value" } },
            IV = "test-iv",
            Version = 1
        };
        var userId = 789;
        
        // Act
        var result = _factory.CreateMessage(request, userId);
        
        // Assert
        result.SenderId.Should().Be(userId);
        result.EncryptedText.Should().Be("encrypted-message");
        result.ConversationId.Should().Be(123);
        result.ParentMessageId.Should().Be(456);
        result.ParentMessagePreview.Should().Be("preview text");
        result.IV.Should().Be("test-iv");
        result.Version.Should().Be(1);
        result.KeyInfo.Should().Contain("value");
    }

    [Fact]
    public void CreateMessageWithAttachments_WithoutAttachments_ShouldCreateMessageWithEmptyAttachments()
    {
        // Arrange
        var request = SendMessageTestHelpers.CreateValidRequest(conversationId: 123);
        var userId = 456;
        
        // Act
        var result = _factory.CreateMessageWithAttachments(request, userId, null);
        
        // Assert
        result.SenderId.Should().Be(userId);
        result.ConversationId.Should().Be(123);
        result.Attachments.Should().BeEmpty();
    }

    [Fact]
    public void CreateMessageWithAttachments_WithAttachments_ShouldCreateMessageWithAttachments()
    {
        // Arrange
        var request = SendMessageTestHelpers.CreateValidRequest(conversationId: 123);
        var userId = 456;
        
        var uploadedAttachments = new List<UploadedAttachment>
        {
            new()
            {
                EncryptedFileUrl = "https://storage/file.enc",
                EncryptedThumbnailUrl = "https://storage/thumb.enc",
                Attachment = SendMessageTestHelpers.CreateValidAttachment(
                    fileName: "photo.jpg",
                    fileType: "image/jpeg",
                    fileSize: 2048)
            }
        };
        
        // Act
        var result = _factory.CreateMessageWithAttachments(request, userId, uploadedAttachments);
        
        // Assert
        result.SenderId.Should().Be(userId);
        result.Attachments.Should().HaveCount(1);
        
        var attachment = result.Attachments.First();
        attachment.EncryptedFileUrl.Should().Be("https://storage/file.enc");
        attachment.EncryptedThumbnailUrl.Should().Be("https://storage/thumb.enc");
        attachment.OriginalFileName.Should().Be("photo.jpg");
        attachment.FileType.Should().Be("image/jpeg");
        attachment.OriginalFileSize.Should().Be(2048);
        attachment.Message.Should().Be(result);
    }

    [Fact]
    public void CreateAttachments_WithValidUploadedAttachments_ShouldCreateCorrectMappings()
    {
        // Arrange
        var message = new Message { Id = 1 };
        var uploadedAttachments = new List<UploadedAttachment>
        {
            new()
            {
                EncryptedFileUrl = "https://storage/file.enc",
                EncryptedThumbnailUrl = "https://storage/thumb.enc",
                Attachment = new SendMessageAttachment
                {
                    FileName = "photo.jpg",
                    FileSize = 2048,
                    FileType = "image/jpeg",
                    KeyInfo = new Dictionary<string, string> { { "key", "attachment-key" } },
                    IV = "attachment-iv",
                    Version = 2,
                    ThumbnailKeyInfo = new Dictionary<string, string> { { "thumbKey", "thumb-key" } },
                    ThumbnailIV = "thumb-iv",
                    ThumbnailWidth = 150,
                    ThumbnailHeight = 100
                }
            }
        };
        
        // Act
        var result = _factory.CreateAttachments(uploadedAttachments, message);
        
        // Assert
        result.Should().HaveCount(1);
        var attachment = result[0];
        attachment.EncryptedFileUrl.Should().Be("https://storage/file.enc");
        attachment.EncryptedThumbnailUrl.Should().Be("https://storage/thumb.enc");
        attachment.OriginalFileName.Should().Be("photo.jpg");
        attachment.OriginalFileSize.Should().Be(2048);
        attachment.FileType.Should().Be("image/jpeg");
        attachment.IV.Should().Be("attachment-iv");
        attachment.Version.Should().Be(2);
        attachment.ThumbnailIV.Should().Be("thumb-iv");
        attachment.ThumbnailWidth.Should().Be(150);
        attachment.ThumbnailHeight.Should().Be(100);
        attachment.Message.Should().Be(message);
        attachment.KeyInfo.Should().Contain("attachment-key");
        attachment.ThumbnailKeyInfo.Should().Contain("thumb-key");
    }

    [Fact]
    public void CreateAttachments_WithMultipleAttachments_ShouldCreateAllCorrectly()
    {
        // Arrange
        var message = new Message { Id = 1 };
        var uploadedAttachments = new List<UploadedAttachment>
        {
            SendMessageTestHelpers.CreateUploadedAttachment(
                fileUrl: "https://storage/file1.enc",
                thumbnailUrl: "https://storage/thumb1.enc"),
            SendMessageTestHelpers.CreateUploadedAttachment(
                fileUrl: "https://storage/file2.enc",
                thumbnailUrl: "https://storage/thumb2.enc")
        };
        
        // Act
        var result = _factory.CreateAttachments(uploadedAttachments, message);
        
        // Assert
        result.Should().HaveCount(2);
        result[0].EncryptedFileUrl.Should().Be("https://storage/file1.enc");
        result[1].EncryptedFileUrl.Should().Be("https://storage/file2.enc");
        result.All(a => a.Message == message).Should().BeTrue();
    }
}