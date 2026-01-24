using AFBack.Features.SendMessage.DTOs;
using AFBack.Features.SendMessage.ResponseBuilder;
using AFBack.Models;
using AFBack.Tests.Helpers;
using FluentAssertions;
using Xunit;

namespace AFBack.Tests.Features.SendMessage.ResponseBuilder;

public class SendMessageResponseBuilderTests
{
    private readonly SendMessageResponseBuilder _responseBuilder = new();

    [Fact]
    public void BuildResponse_WithoutAttachments_ShouldReturnBasicResponse()
    {
        // Arrange
        var message = new Message 
        { 
            Id = 1, 
            SentAt = DateTime.UtcNow,
            ConversationId = 123
        };

        // Act
        var result = _responseBuilder.BuildResponse(message, null);

        // Assert
        result.MessageId.Should().Be(1);
        result.ConversationId.Should().Be(123);
        result.SentAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
        result.Attachments.Should().BeNull();
    }

    [Fact]
    public void BuildResponse_WithEmptyAttachmentsList_ShouldReturnResponseWithoutAttachments()
    {
        // Arrange
        var message = new Message 
        { 
            Id = 1, 
            SentAt = DateTime.UtcNow,
            ConversationId = 123
        };

        // Act
        var result = _responseBuilder.BuildResponse(message, new List<UploadedAttachment>());

        // Assert
        result.MessageId.Should().Be(1);
        result.Attachments.Should().BeNull();
    }

    [Fact]
    public void BuildResponse_AttachmentCountMismatch_ShouldThrowException()
    {
        // Arrange
        var message = new Message 
        { 
            Id = 1, 
            SentAt = DateTime.UtcNow,
            ConversationId = 123,
            Attachments = new List<MessageAttachment>
            {
                new() { Id = 1, EncryptedFileUrl = "url1" },
                new() { Id = 2, EncryptedFileUrl = "url2" }
            }
        };
        
        var uploadedAttachments = new List<UploadedAttachment>
        {
            SendMessageTestHelpers.CreateUploadedAttachment()
            // Only 1 attachment, but message has 2
        };

        // Act & Assert
        var act = () => _responseBuilder.BuildResponse(message, uploadedAttachments);
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*Attachment count mismatch*");
    }

    [Fact]
    public void BuildResponse_WithSingleAttachment_ShouldMapCorrectly()
    {
        // Arrange
        var attachment = SendMessageTestHelpers.CreateValidAttachment(
            fileName: "photo.jpg",
            optimisticId: "temp-123");
        
        var uploadedAttachment = new UploadedAttachment
        {
            EncryptedFileUrl = "https://storage/file.enc",
            EncryptedThumbnailUrl = "https://storage/thumb.enc",
            Attachment = attachment
        };
        
        var message = new Message 
        { 
            Id = 1, 
            SentAt = DateTime.UtcNow,
            ConversationId = 123,
            Attachments = new List<MessageAttachment>
            {
                new() 
                { 
                    Id = 999, 
                    EncryptedFileUrl = "https://storage/file.enc",
                    EncryptedThumbnailUrl = "https://storage/thumb.enc"
                }
            }
        };

        // Act
        var result = _responseBuilder.BuildResponse(message, new List<UploadedAttachment> { uploadedAttachment });

        // Assert
        result.MessageId.Should().Be(1);
        result.ConversationId.Should().Be(123);
        result.Attachments.Should().HaveCount(1);
        result.Attachments![0].Id.Should().Be(999);
        result.Attachments[0].OptimisticId.Should().Be("temp-123");
        result.Attachments[0].FileUrl.Should().Be("https://storage/file.enc");
        result.Attachments[0].ThumbnailUrl.Should().Be("https://storage/thumb.enc");
    }

    [Fact]
    public void BuildResponse_WithMultipleAttachments_ShouldMapAllCorrectly()
    {
        // Arrange
        var uploadedAttachments = new List<UploadedAttachment>
        {
            new()
            {
                EncryptedFileUrl = "https://storage/file1.enc",
                EncryptedThumbnailUrl = "https://storage/thumb1.enc",
                Attachment = SendMessageTestHelpers.CreateValidAttachment(
                    fileName: "photo1.jpg",
                    optimisticId: "temp-1")
            },
            new()
            {
                EncryptedFileUrl = "https://storage/file2.enc",
                EncryptedThumbnailUrl = "https://storage/thumb2.enc",
                Attachment = SendMessageTestHelpers.CreateValidAttachment(
                    fileName: "photo2.jpg",
                    optimisticId: "temp-2")
            }
        };
        
        var message = new Message 
        { 
            Id = 1, 
            SentAt = DateTime.UtcNow,
            ConversationId = 123,
            Attachments = new List<MessageAttachment>
            {
                new() 
                { 
                    Id = 10, 
                    EncryptedFileUrl = "https://storage/file1.enc",
                    EncryptedThumbnailUrl = "https://storage/thumb1.enc"
                },
                new() 
                { 
                    Id = 11, 
                    EncryptedFileUrl = "https://storage/file2.enc",
                    EncryptedThumbnailUrl = "https://storage/thumb2.enc"
                }
            }
        };

        // Act
        var result = _responseBuilder.BuildResponse(message, uploadedAttachments);

        // Assert
        result.Attachments.Should().HaveCount(2);
        result.Attachments![0].Id.Should().Be(10);
        result.Attachments[0].OptimisticId.Should().Be("temp-1");
        result.Attachments[0].FileUrl.Should().Be("https://storage/file1.enc");
        result.Attachments[1].Id.Should().Be(11);
        result.Attachments[1].OptimisticId.Should().Be("temp-2");
        result.Attachments[1].FileUrl.Should().Be("https://storage/file2.enc");
    }

    [Fact]
    public void BuildResponse_WithNullOptimisticId_ShouldHandleGracefully()
    {
        // Arrange
        var attachment = SendMessageTestHelpers.CreateValidAttachment(
            fileName: "photo.jpg",
            optimisticId: null);
        
        var uploadedAttachment = new UploadedAttachment
        {
            EncryptedFileUrl = "https://storage/file.enc",
            EncryptedThumbnailUrl = "https://storage/thumb.enc",
            Attachment = attachment
        };
        
        var message = new Message 
        { 
            Id = 1, 
            SentAt = DateTime.UtcNow,
            ConversationId = 123,
            Attachments = new List<MessageAttachment>
            {
                new() 
                { 
                    Id = 999, 
                    EncryptedFileUrl = "https://storage/file.enc",
                    EncryptedThumbnailUrl = "https://storage/thumb.enc"
                }
            }
        };

        // Act
        var result = _responseBuilder.BuildResponse(message, new List<UploadedAttachment> { uploadedAttachment });

        // Assert
        result.Attachments![0].OptimisticId.Should().BeNull();
    }

    [Fact]
    public void BuildResponse_WithNullThumbnailUrl_ShouldUseEmptyString()
    {
        // Arrange
        var attachment = SendMessageTestHelpers.CreateValidAttachment();
        
        var uploadedAttachment = new UploadedAttachment
        {
            EncryptedFileUrl = "https://storage/file.enc",
            EncryptedThumbnailUrl = null, // Null thumbnail
            Attachment = attachment
        };
        
        var message = new Message 
        { 
            Id = 1, 
            SentAt = DateTime.UtcNow,
            ConversationId = 123,
            Attachments = new List<MessageAttachment>
            {
                new() 
                { 
                    Id = 999, 
                    EncryptedFileUrl = "https://storage/file.enc",
                    EncryptedThumbnailUrl = null
                }
            }
        };

        // Act
        var result = _responseBuilder.BuildResponse(message, new List<UploadedAttachment> { uploadedAttachment });

        // Assert
        result.Attachments![0].ThumbnailUrl.Should().Be(string.Empty);
    }
}