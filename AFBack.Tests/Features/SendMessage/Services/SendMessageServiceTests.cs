using AFBack.Data;
using AFBack.Features.Cache.Interface;
using AFBack.Features.MessageBroadcast.Interface;
using AFBack.Features.SendMessage.DTOs;
using AFBack.Features.SendMessage.Interface;
using AFBack.Features.SendMessage.Services;
using AFBack.Models;
using AFBack.Services;
using AFBack.Tests.Helpers;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using ValidationException = AFBack.Infrastructure.Middleware.ValidationException;

namespace AFBack.Tests.Features.SendMessage.Services;

public class SendMessageServiceTests : IDisposable
{
    private readonly ApplicationDbContext _context;
    private readonly Mock<ISendMessageCache> _mockMsgCache;
    private readonly Mock<ISendMessageValidator> _mockValidator;
    private readonly Mock<ISendMessageFactory> _mockFactory;
    private readonly Mock<ISendMessageResponseBuilder> _mockResponseBuilder;
    private readonly Mock<IMessageBroadcastService> _mockBroadcastService;
    private readonly Mock<IFileService> _mockFileService;
    private readonly Mock<ILogger<SendMessageService>> _mockLogger;
    private readonly SendMessageService _service;

    public SendMessageServiceTests()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        _context = new ApplicationDbContext(options);

        _mockMsgCache = new Mock<ISendMessageCache>();
        _mockValidator = new Mock<ISendMessageValidator>();
        _mockFactory = new Mock<ISendMessageFactory>();
        _mockResponseBuilder = new Mock<ISendMessageResponseBuilder>();
        _mockBroadcastService = new Mock<IMessageBroadcastService>();
        _mockFileService = new Mock<IFileService>();
        _mockLogger = new Mock<ILogger<SendMessageService>>();

        _service = new SendMessageService(
            _context,
            _mockLogger.Object,
            _mockMsgCache.Object,
            _mockValidator.Object,
            _mockFactory.Object,
            _mockResponseBuilder.Object,
            _mockBroadcastService.Object,
            _mockFileService.Object);
    }

    [Fact]
    public async Task SendMessageAsync_CacheHit_ShouldSkipValidationAndOnlyInsertMessage()
    {
        // Arrange
        var request = SendMessageTestHelpers.CreateValidRequest(conversationId: 123);
        var message = new Message { Id = 1, SentAt = DateTime.UtcNow };
        var response = new SendMessageResponse();

        _mockMsgCache.Setup(x => x.CanUserSendAsync(456, 123))
            .ReturnsAsync(true);

        _mockFactory.Setup(x => x.CreateMessageWithAttachments(request, 456, null))
            .Returns(message);

        _mockResponseBuilder.Setup(x => x.BuildResponse(message, null))
            .Returns(response);

        // Act
        var result = await _service.SendMessageAsync(request, 456);

        // Assert
        result.Should().Be(response);
    
        _mockValidator.Verify(x => x.ValidateSendMessageAsync(It.IsAny<SendMessageRequest>(), It.IsAny<int>()), 
            Times.Never);
    
        var savedMessage = await _context.Messages.FirstOrDefaultAsync();
        savedMessage.Should().NotBeNull();
        savedMessage.Should().Be(message);
    
        _mockBroadcastService.Verify(x => x.QueueNewMessageBackgroundTasks(message.Id, 123, 456, message.SentAt), Times.Once);
    }

    [Fact]
    public async Task SendMessageAsync_CacheMiss_ShouldRunFullValidation()
    {
        // Arrange
        var request = SendMessageTestHelpers.CreateValidRequest(conversationId: 123);
        var message = new Message { Id = 1, SentAt = DateTime.UtcNow };
        var response = new SendMessageResponse();

        _mockMsgCache.Setup(x => x.CanUserSendAsync(456, 123))
            .ReturnsAsync(false);

        _mockFactory.Setup(x => x.CreateMessageWithAttachments(request, 456, null))
            .Returns(message);

        _mockResponseBuilder.Setup(x => x.BuildResponse(message, null))
            .Returns(response);

        // Act
        var result = await _service.SendMessageAsync(request, 456);

        // Assert
        result.Should().Be(response);
    
        _mockValidator.Verify(x => x.ValidateSendMessageAsync(request, 456), Times.Once);
    
        var savedMessage = await _context.Messages.FirstOrDefaultAsync();
        savedMessage.Should().NotBeNull();
    
        _mockBroadcastService.Verify(x => x.QueueNewMessageBackgroundTasks(message.Id, 123, 456, message.SentAt), Times.Once);
    }

    [Fact]
    public async Task SendMessageAsync_ShouldOnlyInsertMessage_ConversationUpdateMovedToBackground()
    {
        // Arrange
        var request = SendMessageTestHelpers.CreateValidRequest(conversationId: 123);
        var message = new Message { Id = 1, SentAt = DateTime.UtcNow };
        var response = new SendMessageResponse();

        _mockMsgCache.Setup(x => x.CanUserSendAsync(456, 123))
            .ReturnsAsync(true);
    
        _mockFactory.Setup(x => x.CreateMessageWithAttachments(request, 456, null))
            .Returns(message);
    
        _mockResponseBuilder.Setup(x => x.BuildResponse(message, null))
            .Returns(response);

        // Act
        await _service.SendMessageAsync(request, 456);

        // Assert
        var savedMessage = await _context.Messages.FirstOrDefaultAsync();
        savedMessage.Should().NotBeNull();
    
        var conversations = await _context.Conversations.ToListAsync();
        conversations.Should().BeEmpty();
    
        _mockBroadcastService.Verify(x => x.QueueNewMessageBackgroundTasks(message.Id, 123, 456, message.SentAt), Times.Once);
    }

    [Fact]
    public async Task SendMessageAsync_WithAttachments_ShouldUploadAndCreateMessage()
    {
        // Arrange
        var attachment = SendMessageTestHelpers.CreateValidAttachment();
        var attachments = new List<SendMessageAttachment> { attachment };
        var request = SendMessageTestHelpers.CreateValidRequest(
            conversationId: 123,
            encryptedAttachments: attachments);
        
        var uploadedAttachments = new List<UploadedAttachment>
        {
            new() 
            { 
                EncryptedFileUrl = "https://storage/file.enc",
                EncryptedThumbnailUrl = "https://storage/thumb.enc",
                Attachment = attachment
            }
        };
        
        var message = new Message { Id = 1, SentAt = DateTime.UtcNow };
        var response = new SendMessageResponse();

        _mockMsgCache.Setup(x => x.CanUserSendAsync(456, 123))
            .ReturnsAsync(true);

        _mockFileService.Setup(x => x.UploadEncryptedBytesAsync(
                It.IsAny<byte[]>(), 
                It.IsAny<string>(), 
                It.IsAny<string>()))
            .ReturnsAsync("https://storage/file.enc");
    
        _mockFactory.Setup(x => x.CreateMessageWithAttachments(request, 456, It.IsAny<List<UploadedAttachment>>()))
            .Returns(message);
    
        _mockResponseBuilder.Setup(x => x.BuildResponse(message, It.IsAny<List<UploadedAttachment>>()))
            .Returns(response);

        // Act
        var result = await _service.SendMessageAsync(request, 456);

        // Assert
        result.Should().Be(response);
        _mockFileService.Verify(x => x.UploadEncryptedBytesAsync(
            It.IsAny<byte[]>(), 
            It.IsAny<string>(), 
            It.IsAny<string>()), Times.Exactly(2)); // File + thumbnail
    }

    [Fact]
    public async Task SendMessageAsync_ValidationFails_ShouldThrowException()
    {
        // Arrange
        var request = SendMessageTestHelpers.CreateValidRequest(conversationId: 123);

        _mockMsgCache.Setup(x => x.CanUserSendAsync(456, 123))
            .ReturnsAsync(false);
        
        _mockValidator.Setup(x => x.ValidateSendMessageAsync(request, 456))
            .ThrowsAsync(new ValidationException("User not found"));

        // Act & Assert
        var act = async () => await _service.SendMessageAsync(request, 456);
        await act.Should().ThrowAsync<ValidationException>()
            .WithMessage("User not found");
            
        var messages = await _context.Messages.ToListAsync();
        messages.Should().BeEmpty();
        
        _mockBroadcastService.Verify(x => x.QueueNewMessageBackgroundTasks(
            It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<DateTime>()), 
            Times.Never);
    }

    [Fact]
    public async Task SendMessageAsync_DatabaseError_ShouldCleanupUploadedFiles()
    {
        // Arrange
        var attachment = SendMessageTestHelpers.CreateValidAttachment();
        var request = SendMessageTestHelpers.CreateValidRequest(
            conversationId: 123,
            encryptedAttachments: new List<SendMessageAttachment> { attachment });

        _mockMsgCache.Setup(x => x.CanUserSendAsync(456, 123))
            .ReturnsAsync(true);

        _mockFileService.Setup(x => x.UploadEncryptedBytesAsync(
                It.IsAny<byte[]>(), It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync("https://storage/file.enc");

        var message = new Message { Id = 1, SentAt = DateTime.UtcNow };
        _mockFactory.Setup(x => x.CreateMessageWithAttachments(request, 456, It.IsAny<List<UploadedAttachment>>()))
            .Returns(message);

        // Force database error by adding duplicate
        _context.Messages.Add(new Message { Id = 1 });
        await _context.SaveChangesAsync();

        // Act & Assert
        var act = async () => await _service.SendMessageAsync(request, 456);
        await act.Should().ThrowAsync<Exception>();
        
        // Verify cleanup was called on fileService
        _mockFileService.Verify(x => x.TryCleanupFilesAsync(
            It.Is<List<string>>(urls => urls.Count > 0), 
            "SendMessageAsync", 
            456), Times.Once);
        
        _mockBroadcastService.Verify(x => x.QueueNewMessageBackgroundTasks(
            It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<DateTime>()), 
            Times.Never);
    }

    public void Dispose()
    {
        _context?.Dispose();
    }
    
    [Fact]
    public async Task UploadAttachment_MoreThan10Attachments_ShouldThrowValidationException()
    {
        // Arrange
        var attachments = Enumerable.Range(0, 11)
            .Select(_ => SendMessageTestHelpers.CreateValidAttachment())
            .ToList();
    
        var request = SendMessageTestHelpers.CreateValidRequest(
            conversationId: 123,
            encryptedAttachments: attachments);

        _mockMsgCache.Setup(x => x.CanUserSendAsync(456, 123))
            .ReturnsAsync(true);

        // Act & Assert
        var act = async () => await _service.SendMessageAsync(request, 456);
        await act.Should().ThrowAsync<ValidationException>()
            .WithMessage("The limit is 10 attachments");
    }
    
    [Fact]
    public async Task UploadAttachment_InvalidBase64_ShouldThrowValidationException()
    {
        // Arrange
        var attachment = SendMessageTestHelpers.CreateValidAttachment(
            encryptedFileData: "not-valid-base64!!!",
            encryptedThumbnailData: "dGVzdA==");
    
        var request = SendMessageTestHelpers.CreateValidRequest(
            conversationId: 123,
            encryptedAttachments: new List<SendMessageAttachment> { attachment });

        _mockMsgCache.Setup(x => x.CanUserSendAsync(456, 123))
            .ReturnsAsync(true);

        // Act & Assert
        var act = async () => await _service.SendMessageAsync(request, 456);
        await act.Should().ThrowAsync<ValidationException>()
            .WithMessage("*Invalid base64 data*");
    }
    
    [Fact]
    public async Task UploadAttachment_EmptyFileData_ShouldThrowValidationException()
    {
        // Arrange - Base64 encode empty string
        var attachment = SendMessageTestHelpers.CreateValidAttachment(
            encryptedFileData: Convert.ToBase64String(Array.Empty<byte>()),
            encryptedThumbnailData: "dGVzdA==");
    
        var request = SendMessageTestHelpers.CreateValidRequest(
            conversationId: 123,
            encryptedAttachments: new List<SendMessageAttachment> { attachment });

        _mockMsgCache.Setup(x => x.CanUserSendAsync(456, 123))
            .ReturnsAsync(true);

        // Act & Assert
        var act = async () => await _service.SendMessageAsync(request, 456);
        await act.Should().ThrowAsync<ValidationException>()
            .WithMessage("*Empty encrypted data*");
    }
    
    [Fact]
    public async Task UploadAttachment_EmptyThumbnailData_ShouldThrowValidationException()
    {
        // Arrange
        var attachment = SendMessageTestHelpers.CreateValidAttachment(
            encryptedFileData: "dGVzdA==",
            encryptedThumbnailData: Convert.ToBase64String(Array.Empty<byte>()));
    
        var request = SendMessageTestHelpers.CreateValidRequest(
            conversationId: 123,
            encryptedAttachments: new List<SendMessageAttachment> { attachment });

        _mockMsgCache.Setup(x => x.CanUserSendAsync(456, 123))
            .ReturnsAsync(true);

        // Act & Assert
        var act = async () => await _service.SendMessageAsync(request, 456);
        await act.Should().ThrowAsync<ValidationException>()
            .WithMessage("*Empty encrypted thumbnaildata*");
    }
    
    [Fact]
    public async Task UploadAttachment_SecondFileFailsUpload_ShouldCleanupFirstFile()
    {
        // Arrange
        var attachment1 = SendMessageTestHelpers.CreateValidAttachment(fileName: "file1.jpg");
        var attachment2 = SendMessageTestHelpers.CreateValidAttachment(fileName: "file2.jpg");
    
        var request = SendMessageTestHelpers.CreateValidRequest(
            conversationId: 123,
            encryptedAttachments: new List<SendMessageAttachment> { attachment1, attachment2 });

        _mockMsgCache.Setup(x => x.CanUserSendAsync(456, 123))
            .ReturnsAsync(true);

        var uploadCallCount = 0;
        _mockFileService.Setup(x => x.UploadEncryptedBytesAsync(
                It.IsAny<byte[]>(), It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(() =>
            {
                uploadCallCount++;
                if (uploadCallCount <= 2) // First file + thumbnail succeed
                    return $"https://storage/file{uploadCallCount}.enc";
            
                throw new Exception("Storage failure"); // Second file fails
            });

        // Act & Assert
        var act = async () => await _service.SendMessageAsync(request, 456);
        await act.Should().ThrowAsync<Exception>();
    
        // Verify cleanup was called with the first file's URLs
        _mockFileService.Verify(x => x.TryCleanupFilesAsync(
            It.Is<List<string>>(urls => urls.Count == 2), // file1 + thumb1
            "UploadAttachment",
            456), Times.Once);
    }
}