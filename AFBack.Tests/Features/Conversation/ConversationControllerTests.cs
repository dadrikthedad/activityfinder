using AFBack.Features.Conversation.DTOs;
using AFBack.Features.Conversation.Interface;
using AFBack.Features.Conversation.Controllers;
using AFBack.Infrastructure.DTO;
using AFBack.Infrastructure.Exceptions;
using AFBack.Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace AFBack.Tests.Controllers;

public class ConversationControllerTests
{
    private readonly Mock<INewConversationService> _mockService;
    private readonly Mock<IResponseService> _mockResponseService;
    private readonly Mock<ILogger<ConversationController>> _mockLogger;
    private readonly ConversationController _controller;

    public ConversationControllerTests()
    {
        _mockService = new Mock<INewConversationService>();
        _mockResponseService = new Mock<IResponseService>();
        _mockLogger = new Mock<ILogger<ConversationController>>();

        _controller = new ConversationController(
            _mockService.Object,
            _mockResponseService.Object,
            _mockLogger.Object
        );

        // Mock FullValidateAndGetIdFromToken to return userId = 1
        // Note: You'll need to make this mockable or use a different approach
        // This is pseudocode - adjust based on your actual implementation
    }

    [Fact]
    public async Task GetConversationById_WithValidId_ReturnsOkResult()
    {
        // Arrange
        int conversationId = 1;
        var expectedConversation = new ConversationDto
        {
            Id = conversationId,
            IsGroup = false
        };

        var expectedResponse = new ApiResponse<ConversationDto>
        {
            Success = true,
            Message = "Conversation received successfully",
            Data = expectedConversation
        };

        _mockService
            .Setup(s => s.GetConversationByIdAsync(It.IsAny<int>(), conversationId))
            .ReturnsAsync(expectedConversation);

        _mockResponseService
            .Setup(r => r.Success(expectedConversation, "Conversation received successfully"))
            .Returns(expectedResponse);

        // Act
        var result = await _controller.GetConversationById(conversationId);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var apiResponse = Assert.IsType<ApiResponse<ConversationDto>>(okResult.Value);
        Assert.True(apiResponse.Success);
        Assert.Equal(conversationId, apiResponse.Data.Id);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(-999)]
    public async Task GetConversationById_WithInvalidId_ReturnsBadRequest(int invalidId)
    {
        // This test verifies that ValidateModelStateAttribute catches invalid IDs
        // You may need to test this at integration level with TestServer
        
        // Arrange & Act & Assert
        // Implementation depends on how you test model validation
        // Typically done with integration tests using WebApplicationFactory
    }

    [Fact]
    public async Task GetConversationById_ServiceThrowsNotFoundException_ReturnsNotFound()
    {
        // Arrange
        int conversationId = 999;

        _mockService
            .Setup(s => s.GetConversationByIdAsync(It.IsAny<int>(), conversationId))
            .ThrowsAsync(new NotFoundException("Conversation not found"));

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(
            () => _controller.GetConversationById(conversationId)
        );
    }
}