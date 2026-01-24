using AFBack.Data;
using AFBack.Features.Cache.Interface;
using AFBack.Features.SendMessage.DTOs;
using AFBack.Features.SendMessage.Validators;
using AFBack.Interface.Repository;
using AFBack.Models;
using AFBack.Tests.Helpers;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using ValidationException = AFBack.Infrastructure.Middleware.ValidationException;

namespace AFBack.Tests.Features.SendMessage.Validators;

public class SendMessageValidatorTests
{
    private readonly Mock<IMessageRepository> _mockMessageRepository;
    private readonly Mock<IUserBlockRepository> _mockUserBlockRepository;
    private readonly Mock<IConversationRepository> _mockConversationRepository;
    private readonly Mock<IUserCache> _mockUserCache;
    private readonly Mock<ILogger<SendMessageValidator>> _mockLogger;
    private readonly SendMessageValidator _validator;

    public SendMessageValidatorTests()
    {
        _mockMessageRepository = new Mock<IMessageRepository>();
        _mockUserBlockRepository = new Mock<IUserBlockRepository>();
        _mockConversationRepository = new Mock<IConversationRepository>();
        _mockUserCache = new Mock<IUserCache>();
        _mockLogger = new Mock<ILogger<SendMessageValidator>>();
        
        _validator = new SendMessageValidator(
            _mockMessageRepository.Object,
            _mockUserBlockRepository.Object,
            _mockConversationRepository.Object,
            _mockLogger.Object,
            _mockUserCache.Object);
    }

    [Fact]
    public async Task ValidateSendMessageAsync_UserNotExists_ShouldThrowException()
    {
        // Arrange
        var request = SendMessageTestHelpers.CreateValidRequest(conversationId: 123);
        _mockUserCache.Setup(x => x.UserExistsAsync(456))
            .ReturnsAsync(false);

        // Act & Assert
        await FluentActions.Invoking(() => _validator.ValidateSendMessageAsync(request, 456))
            .Should().ThrowAsync<ValidationException>()
            .WithMessage("User not found");
    }

    [Fact]
    public async Task ValidateSendMessageAsync_ConversationNotFound_ShouldThrowException()
    {
        // Arrange
        var request = SendMessageTestHelpers.CreateValidRequest(conversationId: 123);
        _mockUserCache.Setup(x => x.UserExistsAsync(456))
            .ReturnsAsync(true);
        _mockConversationRepository.Setup(x => x.GetConversation(123))
            .ReturnsAsync((Conversation?)null);

        // Act & Assert
        await FluentActions.Invoking(() => _validator.ValidateSendMessageAsync(request, 456))
            .Should().ThrowAsync<ValidationException>()
            .WithMessage("Conversation 123 does not exist");
    }
    
    [Fact]
    public async Task ValidateSendMessageAsync_UserNotParticipant_ShouldThrowException()
    {
        // Arrange
        var request = SendMessageTestHelpers.CreateValidRequest(conversationId: 123);
        var conversation = SendMessageTestHelpers.CreateTestConversation(
            id: 123,
            participantUserIds: 999); // Different user
        
        _mockUserCache.Setup(x => x.UserExistsAsync(456))
            .ReturnsAsync(true);
        _mockConversationRepository.Setup(x => x.GetConversation(123))
            .ReturnsAsync(conversation);

        // Act & Assert
        await FluentActions.Invoking(() => _validator.ValidateSendMessageAsync(request, 456))
            .Should().ThrowAsync<ValidationException>()
            .WithMessage("You are not authorized to send messages in this conversation.");
    }

    [Fact]
    public async Task ValidateSendMessageAsync_UserDeletedConversation_ShouldThrowException()
    {
        // Arrange
        var request = SendMessageTestHelpers.CreateValidRequest(conversationId: 123);
        var conversation = SendMessageTestHelpers.CreateTestConversationWithParticipants(
            id: 123,
            isGroup: false,
            SendMessageTestHelpers.CreateConversationParticipant(
                userId: 456, 
                hasDeleted: true));
        
        _mockUserCache.Setup(x => x.UserExistsAsync(456))
            .ReturnsAsync(true);
        _mockConversationRepository.Setup(x => x.GetConversation(123))
            .ReturnsAsync(conversation);

        // Act & Assert
        await FluentActions.Invoking(() => _validator.ValidateSendMessageAsync(request, 456))
            .Should().ThrowAsync<ValidationException>()
            .WithMessage("Cannot send messages to deleted conversation.");
    }

    [Fact]
    public async Task ValidateSendMessageAsync_ParentMessageNotFound_ShouldThrowException()
    {
        // Arrange
        var request = SendMessageTestHelpers.CreateValidRequest(
            conversationId: 123,
            parentMessageId: 999);
        var conversation = SendMessageTestHelpers.CreateTestConversationWithParticipants(
            id: 123,
            isGroup: false,
            SendMessageTestHelpers.CreateConversationParticipant(userId: 456));
        
        _mockUserCache.Setup(x => x.UserExistsAsync(456))
            .ReturnsAsync(true);
        _mockConversationRepository.Setup(x => x.GetConversation(123))
            .ReturnsAsync(conversation);
        _mockMessageRepository.Setup(x => x.MessageExists(999))
            .ReturnsAsync(false);

        // Act & Assert
        await FluentActions.Invoking(() => _validator.ValidateSendMessageAsync(request, 456))
            .Should().ThrowAsync<ValidationException>()
            .WithMessage("Parent Message not found");
    }

    [Fact]
    public async Task ValidateSendMessageAsync_ValidRequest_ShouldNotThrowException()
    {
        // Arrange
        var request = SendMessageTestHelpers.CreateValidRequest();
        var conversation = SendMessageTestHelpers.CreateTestConversation(
            id: 123, 
            isGroup: true, 
            participantUserIds: 456);
    
        _mockUserCache.Setup(x => x.UserExistsAsync(456))
            .ReturnsAsync(true);
        _mockConversationRepository.Setup(x => x.GetConversation(123))
            .ReturnsAsync(conversation);

        // Act & Assert
        await FluentActions.Invoking(() => _validator.ValidateSendMessageAsync(request, 456))
            .Should().NotThrowAsync();
    }
    
    [Fact]
    public async Task ValidateSendMessageAsync_OneOnOne_SenderBlockedReceiver_ShouldThrowException()
    {
        // Arrange
        var request = SendMessageTestHelpers.CreateValidRequest(conversationId: 123);
        var conversation = SendMessageTestHelpers.CreateTestConversationWithParticipants(
            id: 123,
            isGroup: false,
            SendMessageTestHelpers.CreateConversationParticipant(userId: 456),
            SendMessageTestHelpers.CreateConversationParticipant(userId: 789));
        
        _mockUserCache.Setup(x => x.UserExistsAsync(456))
            .ReturnsAsync(true);
        _mockConversationRepository.Setup(x => x.GetConversation(123))
            .ReturnsAsync(conversation);
        _mockUserBlockRepository.Setup(x => x.IsFirstUserBlockedBySecondary(789, 456))
            .ReturnsAsync(true);

        // Act & Assert
        await FluentActions.Invoking(() => _validator.ValidateSendMessageAsync(request, 456))
            .Should().ThrowAsync<ValidationException>()
            .WithMessage("You cannot send messages to a userId you have blocked.");
    }

    [Fact]
    public async Task ValidateSendMessageAsync_OneOnOne_SenderIsBlocked_ShouldThrowException()
    {
        // Arrange
        var request = SendMessageTestHelpers.CreateValidRequest(conversationId: 123);
        var conversation = SendMessageTestHelpers.CreateTestConversationWithParticipants(
            id: 123,
            isGroup: false,
            SendMessageTestHelpers.CreateConversationParticipant(userId: 456),
            SendMessageTestHelpers.CreateConversationParticipant(userId: 789));
        
        _mockUserCache.Setup(x => x.UserExistsAsync(456))
            .ReturnsAsync(true);
        _mockConversationRepository.Setup(x => x.GetConversation(123))
            .ReturnsAsync(conversation);
        _mockUserBlockRepository.Setup(x => x.IsFirstUserBlockedBySecondary(789, 456))
            .ReturnsAsync(false);
        _mockUserBlockRepository.Setup(x => x.IsFirstUserBlockedBySecondary(456, 789))
            .ReturnsAsync(true);

        // Act & Assert
        await FluentActions.Invoking(() => _validator.ValidateSendMessageAsync(request, 456))
            .Should().ThrowAsync<ValidationException>()
            .WithMessage("This userId has been deleted or is no longer visible, or you lack the required permission to send messages.");
    }
    
    [Fact]
    public async Task ValidateSendMessageAsync_UserNotApprovedConversation_ShouldThrowException()
    {
        // Arrange
        var request = SendMessageTestHelpers.CreateValidRequest(conversationId: 123);
        var conversation = SendMessageTestHelpers.CreateTestConversationWithParticipants(
            id: 123,
            isGroup: false,
            SendMessageTestHelpers.CreateConversationParticipant(
                userId: 456, 
                status: ConversationStatus.Pending));
        
        _mockUserCache.Setup(x => x.UserExistsAsync(456))
            .ReturnsAsync(true);
        _mockConversationRepository.Setup(x => x.GetConversation(123))
            .ReturnsAsync(conversation);

        // Act & Assert
        await FluentActions.Invoking(() => _validator.ValidateSendMessageAsync(request, 456))
            .Should().ThrowAsync<ValidationException>()
            .WithMessage("You must approve the conversation to send messages.");
    }

    [Fact]
    public async Task ValidateSendMessageAsync_OneOnOne_ReceiverDeletedConversation_ShouldThrowException()
    {
        // Arrange
        var request = SendMessageTestHelpers.CreateValidRequest(conversationId: 123);
        var conversation = SendMessageTestHelpers.CreateTestConversationWithParticipants(
            id: 123,
            isGroup: false,
            SendMessageTestHelpers.CreateConversationParticipant(userId: 456),
            SendMessageTestHelpers.CreateConversationParticipant(userId: 789, hasDeleted: true));
        
        _mockUserCache.Setup(x => x.UserExistsAsync(456))
            .ReturnsAsync(true);
        _mockConversationRepository.Setup(x => x.GetConversation(123))
            .ReturnsAsync(conversation);
        _mockUserBlockRepository.Setup(x => x.IsFirstUserBlockedBySecondary(It.IsAny<int>(), It.IsAny<int>()))
            .ReturnsAsync(false);

        // Act & Assert
        await FluentActions.Invoking(() => _validator.ValidateSendMessageAsync(request, 456))
            .Should().ThrowAsync<ValidationException>()
            .WithMessage("This userId has been deleted or is no longer visible, or you lack the required permission to send messages.");
    }

    [Fact]
    public async Task ValidateSendMessageAsync_OneOnOne_ReceiverNotApproved_ShouldThrowException()
    {
        // Arrange
        var request = SendMessageTestHelpers.CreateValidRequest(conversationId: 123);
        var conversation = SendMessageTestHelpers.CreateTestConversationWithParticipants(
            id: 123,
            isGroup: false,
            SendMessageTestHelpers.CreateConversationParticipant(userId: 456),
            SendMessageTestHelpers.CreateConversationParticipant(userId: 789, status: ConversationStatus.Pending));
        
        _mockUserCache.Setup(x => x.UserExistsAsync(456))
            .ReturnsAsync(true);
        _mockConversationRepository.Setup(x => x.GetConversation(123))
            .ReturnsAsync(conversation);
        _mockUserBlockRepository.Setup(x => x.IsFirstUserBlockedBySecondary(It.IsAny<int>(), It.IsAny<int>()))
            .ReturnsAsync(false);

        // Act & Assert
        await FluentActions.Invoking(() => _validator.ValidateSendMessageAsync(request, 456))
            .Should().ThrowAsync<ValidationException>()
            .WithMessage("The userId has not accepted your request.");
    }
}