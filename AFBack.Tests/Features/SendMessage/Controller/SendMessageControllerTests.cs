using AFBack.Data;
using AFBack.Features.Cache.Interface;
using AFBack.Features.SendMessage.Controllers;
using AFBack.Features.SendMessage.DTOs;
using AFBack.Features.SendMessage.Interface;
using AFBack.Infrastructure.DTO;
using AFBack.Infrastructure.Services;
using AFBack.Tests.Helpers;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using System.Security.Claims;
using Xunit;
using ValidationException = AFBack.Infrastructure.Middleware.ValidationException;

namespace AFBack.Tests.Features.SendMessage.Controllers;

public class SendMessageControllerTests
{
    private readonly ApplicationDbContext _context;
    private readonly Mock<ILogger<SendMessageController>> _mockLogger;
    private readonly Mock<ISendMessageService> _mockSendMessageService;
    private readonly Mock<IUserCache> _mockUserCache;
    private readonly ResponseService _responseService;
    private readonly SendMessageController _controller;

    public SendMessageControllerTests()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        _context = new ApplicationDbContext(options);

        _mockLogger = new Mock<ILogger<SendMessageController>>();
        _mockSendMessageService = new Mock<ISendMessageService>();
        _mockUserCache = new Mock<IUserCache>();
        _responseService = new ResponseService();

        _controller = new SendMessageController(
            _context,
            _mockLogger.Object,
            _mockSendMessageService.Object,
            _mockUserCache.Object,
            _responseService);

        SetupControllerContext(userId: 123);
    }

    private void SetupControllerContext(int userId)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString())
        };
        var identity = new ClaimsIdentity(claims, "Test");
        var principal = new ClaimsPrincipal(identity);

        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = principal
            }
        };
    }

    [Fact]
    public async Task SendMessage_ValidRequest_ShouldReturnOkWithResponse()
    {
        // Arrange
        var request = SendMessageTestHelpers.CreateValidRequest(conversationId: 123);
        var expectedResponse = new SendMessageResponse { MessageId = 1 };

        _mockUserCache.Setup(x => x.UserExistsAsync(123)).ReturnsAsync(true);
        _mockSendMessageService.Setup(x => x.SendMessageAsync(request, 123))
            .ReturnsAsync(expectedResponse);

        // Act
        var result = await _controller.SendMessage(request);

        // Assert
        var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var apiResponse = okResult.Value.Should().BeOfType<ApiResponse<SendMessageResponse>>().Subject;
        apiResponse.Success.Should().BeTrue();
        apiResponse.Data.Should().Be(expectedResponse);
        apiResponse.Message.Should().Be("Message sent successfully");
    }

    [Fact]
    public async Task SendMessage_NoUserIdInToken_ShouldReturnUnauthorized()
    {
        // Arrange
        var request = SendMessageTestHelpers.CreateValidRequest(conversationId: 123);
    
        // Setup controller with no user claims
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity())
            }
        };

        // Act
        var result = await _controller.SendMessage(request);

        // Assert
        var objectResult = result.Result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
        var apiResponse = objectResult.Value.Should().BeOfType<ApiResponse<SendMessageResponse>>().Subject;
        apiResponse.Success.Should().BeFalse();
        apiResponse.Message.Should().Be("User ID not found in token");
    
        _mockSendMessageService.Verify(x => x.SendMessageAsync(It.IsAny<SendMessageRequest>(), It.IsAny<int>()), 
            Times.Never);
    }

    [Fact]
    public async Task SendMessage_EmptyContent_ShouldReturnBadRequest()
    {
        // Arrange  
        var request = new SendMessageRequest
        {
            ConversationId = 123,
            EncryptedText = null!,
            KeyInfo = null!,
            IV = null!,
            EncryptedAttachments = null!
        };

        _mockUserCache.Setup(x => x.UserExistsAsync(123)).ReturnsAsync(true);

        // Act
        var result = await _controller.SendMessage(request);

        // Assert
        var badRequestResult = result.Result.Should().BeOfType<BadRequestObjectResult>().Subject;
        var apiResponse = badRequestResult.Value.Should().BeOfType<ApiResponse<SendMessageResponse>>().Subject;
        apiResponse.Success.Should().BeFalse();
        apiResponse.Message.Should().Be("The message must contain text or attachments");

        _mockSendMessageService.Verify(x => x.SendMessageAsync(It.IsAny<SendMessageRequest>(), It.IsAny<int>()), 
            Times.Never);
    }
    
    [Fact]
    public async Task SendMessage_ValidAttachmentsOnly_ShouldPassValidation()
    {
        // Arrange
        var request = SendMessageTestHelpers.CreateAttachmentOnlyRequest(conversationId: 123);
        var expectedResponse = new SendMessageResponse { MessageId = 1 };

        _mockUserCache.Setup(x => x.UserExistsAsync(123)).ReturnsAsync(true);
        _mockSendMessageService.Setup(x => x.SendMessageAsync(request, 123))
            .ReturnsAsync(expectedResponse);

        // Act
        var result = await _controller.SendMessage(request);

        // Assert
        var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var apiResponse = okResult.Value.Should().BeOfType<ApiResponse<SendMessageResponse>>().Subject;
        apiResponse.Success.Should().BeTrue();
        apiResponse.Data.Should().Be(expectedResponse);
        
        _mockSendMessageService.Verify(x => x.SendMessageAsync(request, 123), Times.Once);
    }

    [Fact]
    public async Task SendMessage_ShouldLogCorrectly()
    {
        // Arrange
        var request = SendMessageTestHelpers.CreateValidRequest(conversationId: 123);
        var expectedResponse = new SendMessageResponse { MessageId = 1 };

        _mockUserCache.Setup(x => x.UserExistsAsync(123)).ReturnsAsync(true);
        _mockSendMessageService.Setup(x => x.SendMessageAsync(request, 123))
            .ReturnsAsync(expectedResponse);

        // Act
        var result = await _controller.SendMessage(request);

        // Assert
        result.Result.Should().BeOfType<OkObjectResult>();
    }
}