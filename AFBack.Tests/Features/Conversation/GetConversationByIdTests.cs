using AFBack.Features.Conversation.DTOs;
using AFBack.Features.Conversation.Interface;
using AFBack.Features.Conversation.Services;
using AFBack.Infrastructure.Exceptions;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace AFBack.Tests.Services;

public class NewConversationServiceTests
{
    private readonly Mock<IConversationRepository> _mockRepository;
    private readonly Mock<ILogger<NewConversationService>> _mockLogger;
    private readonly NewConversationService _service;

    public NewConversationServiceTests()
    {
        _mockRepository = new Mock<IConversationRepository>();
        _mockLogger = new Mock<ILogger<NewConversationService>>();
        
        _service = new NewConversationService(
            null!, // context not used in this method
            _mockLogger.Object,
            _mockRepository.Object,
            null!  // responseBuilder not used in GetConversationByIdAsync
        );
    }

    [Fact]
    public async Task GetConversationByIdAsync_WithValidData_ReturnsConversation()
    {
        // Arrange
        int userId = 1;
        int conversationId = 1;
        var expectedConversation = new ConversationDto
        {
            Id = conversationId,
            IsGroup = false,
            Participants = new List<ConversationParticipantDto>()
        };

        _mockRepository
            .Setup(r => r.GetUserConversationDtoById(userId, conversationId))
            .ReturnsAsync(expectedConversation);

        // Act
        var result = await _service.GetConversationByIdAsync(userId, conversationId);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(conversationId, result.Id);
        _mockRepository.Verify(r => r.GetUserConversationDtoById(userId, conversationId), Times.Once);
    }

    [Fact]
    public async Task GetConversationByIdAsync_ConversationNotFound_ThrowsNotFoundException()
    {
        // Arrange
        int userId = 1;
        int conversationId = 999;

        _mockRepository
            .Setup(r => r.GetUserConversationDtoById(userId, conversationId))
            .ReturnsAsync((ConversationDto?)null);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<NotFoundException>(
            () => _service.GetConversationByIdAsync(userId, conversationId)
        );

        Assert.Contains("No conversation found", exception.Message);
        _mockRepository.Verify(r => r.GetUserConversationDtoById(userId, conversationId), Times.Once);
    }

    [Fact]
    public async Task GetConversationByIdAsync_UserNotParticipant_ThrowsNotFoundException()
    {
        // Arrange
        int userId = 1;
        int conversationId = 2;

        _mockRepository
            .Setup(r => r.GetUserConversationDtoById(userId, conversationId))
            .ReturnsAsync((ConversationDto?)null);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<NotFoundException>(
            () => _service.GetConversationByIdAsync(userId, conversationId)
        );

        Assert.Contains("lack permission", exception.Message);
    }

    [Theory]
    [InlineData(1, 1)]
    [InlineData(5, 10)]
    [InlineData(999, 1)]
    public async Task GetConversationByIdAsync_WithVariousIds_CallsRepositoryCorrectly(
        int userId, int conversationId)
    {
        // Arrange
        var conversation = new ConversationDto { Id = conversationId };
        _mockRepository
            .Setup(r => r.GetUserConversationDtoById(userId, conversationId))
            .ReturnsAsync(conversation);

        // Act
        await _service.GetConversationByIdAsync(userId, conversationId);

        // Assert
        _mockRepository.Verify(
            r => r.GetUserConversationDtoById(userId, conversationId), 
            Times.Once
        );
    }
}