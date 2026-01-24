using AFBack.Controllers;
using AFBack.Data;
using AFBack.DTOs;
using AFBack.Features.Cache.Interface;
using AFBack.Features.Conversation.Controller;
using AFBack.Features.Conversation.DTOs;
using AFBack.Features.Conversation.Interface;
using AFBack.Infrastructure.DTO;
using AFBack.Infrastructure.Services;
using AFBack.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using System.Security.Claims;
using Xunit;

namespace AFBack.Tests.Features.Conversation;

public class GetMyConversationsTests : IDisposable
{
    private readonly ApplicationDbContext _context;
    private readonly Mock<ILogger<NewConversationController>> _mockLogger;
    private readonly Mock<IUserCache> _mockUserCache;
    private readonly Mock<ResponseService> _mockResponseService;
    private readonly Mock<INewConversationService> _mockConversationService;
    private readonly NewConversationController _controller;

    public GetMyConversationsTests()
    {
        // Setup in-memory database
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        _context = new ApplicationDbContext(options);

        // Setup mocks
        _mockLogger = new Mock<ILogger<NewConversationController>>();
        _mockUserCache = new Mock<IUserCache>();
        _mockResponseService = new Mock<ResponseService>();
        _mockConversationService = new Mock<INewConversationService>();

        // Create controller
        _controller = new NewConversationController(
            _context,
            _mockLogger.Object,
            _mockUserCache.Object,
            _mockResponseService.Object,
            _mockConversationService.Object)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                    {
                        new Claim(ClaimTypes.NameIdentifier, "1")
                    }))
                }
            }
        };
    }

    [Fact]
    public async Task GetMyConversations_ValidRequest_ReturnsSuccess()
    {
        // Arrange
        var userId = 1;
        var request = new ConversationsRequest
        {
            Status = ConversationStatus.Accepted,
            Page = 1,
            PageSize = 20
        };

        _mockUserCache.Setup(x => x.UserExistsAsync(userId))
            .ReturnsAsync(true);

        var expectedResponse = new ConversationsResponse
        {
            Conversations = new List<ConversationDto>
            {
                new ConversationDto
                {
                    Id = 1,
                    IsGroup = false,
                    GroupName = null,
                    LastMessageSentAt = DateTime.UtcNow,
                    Participants = new List<ConversationParticipantDto>
                    {
                        new ConversationParticipantDto
                        {
                            User = new UserSummaryDTO { Id = 1, FullName = "Test User" },
                            ConversationStatus = ConversationStatus.Accepted,
                            IsCreator = false
                        }
                    }
                }
            },
            TotalCount = 1,
            PageSize = 20,
            CurrentPage = 1,
            HasMore = false
        };

        _mockConversationService
            .Setup(x => x.GetUserConversationsAsync(userId, It.IsAny<ConversationsRequest>()))
            .ReturnsAsync(expectedResponse);

        _mockResponseService
            .Setup(x => x.Success(expectedResponse, "Conversations received successfully"))
            .Returns(new OkObjectResult(new ApiResponse<ConversationsResponse>
            {
                Success = true,
                Data = expectedResponse,
                Message = "Conversations received successfully"
            }));

        // Act
        var result = await _controller.GetMyConversations(request);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var apiResponse = Assert.IsType<ApiResponse<ConversationsResponse>>(okResult.Value);
        Assert.True(apiResponse.Success);
        Assert.Equal(1, apiResponse.Data.Conversations.Count);
        Assert.Equal(1, apiResponse.Data.TotalCount);
    }

    [Theory]
    [InlineData(ConversationStatus.Accepted)]
    [InlineData(ConversationStatus.Pending)]
    [InlineData(ConversationStatus.Rejected)]
    public async Task GetMyConversations_DifferentStatuses_ReturnsCorrectConversations(ConversationStatus status)
    {
        // Arrange
        var userId = 1;
        var request = new ConversationsRequest
        {
            Status = status,
            Page = 1,
            PageSize = 20
        };

        _mockUserCache.Setup(x => x.UserExistsAsync(userId))
            .ReturnsAsync(true);

        var expectedResponse = new ConversationsResponse
        {
            Conversations = new List<ConversationDto>
            {
                new ConversationDto
                {
                    Id = 1,
                    IsGroup = false,
                    Participants = new List<ConversationParticipantDto>
                    {
                        new ConversationParticipantDto
                        {
                            User = new UserSummaryDTO { Id = 1, FullName = "Test User" },
                            ConversationStatus = status,
                            IsCreator = false
                        }
                    }
                }
            },
            TotalCount = 1,
            PageSize = 20,
            CurrentPage = 1,
            HasMore = false
        };

        _mockConversationService
            .Setup(x => x.GetUserConversationsAsync(userId, It.Is<ConversationsRequest>(r => r.Status == status)))
            .ReturnsAsync(expectedResponse);

        _mockResponseService
            .Setup(x => x.Success(expectedResponse, "Conversations received successfully"))
            .Returns(new OkObjectResult(new ApiResponse<ConversationsResponse>
            {
                Success = true,
                Data = expectedResponse
            }));

        // Act
        var result = await _controller.GetMyConversations(request);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var apiResponse = Assert.IsType<ApiResponse<ConversationsResponse>>(okResult.Value);
        Assert.True(apiResponse.Success);
        Assert.Equal(status, apiResponse.Data.Conversations.First().Participants.First().ConversationStatus);
    }

    [Fact]
    public async Task GetMyConversations_InvalidPageInRequest_ReturnsBadRequest()
    {
        // Arrange
        var request = new ConversationsRequest
        {
            Status = ConversationStatus.Accepted,
            Page = 0, // Invalid
            PageSize = 20
        };

        // Simuler ModelState error
        _controller.ModelState.AddModelError("Page", "Page must be greater than 0");

        _mockResponseService
            .Setup(x => x.BadRequest<ConversationsResponse>(It.IsAny<string>()))
            .Returns(new BadRequestObjectResult(new ApiResponse<ConversationsResponse>
            {
                Success = false,
                Message = "Page must be greater than 0"
            }));

        // Act
        var result = await _controller.GetMyConversations(request);

        // Assert
        var badRequestResult = Assert.IsType<BadRequestObjectResult>(result.Result);
        var apiResponse = Assert.IsType<ApiResponse<ConversationsResponse>>(badRequestResult.Value);
        Assert.False(apiResponse.Success);
    }

    [Fact]
    public async Task GetMyConversations_InvalidPageSizeInRequest_ReturnsBadRequest()
    {
        // Arrange
        var request = new ConversationsRequest
        {
            Status = ConversationStatus.Accepted,
            Page = 1,
            PageSize = 101 // Invalid (> 100)
        };

        // Simuler ModelState error
        _controller.ModelState.AddModelError("PageSize", "PageSize must be between 1 and 100");

        _mockResponseService
            .Setup(x => x.BadRequest<ConversationsResponse>(It.IsAny<string>()))
            .Returns(new BadRequestObjectResult(new ApiResponse<ConversationsResponse>
            {
                Success = false,
                Message = "PageSize must be between 1 and 100"
            }));

        // Act
        var result = await _controller.GetMyConversations(request);

        // Assert
        var badRequestResult = Assert.IsType<BadRequestObjectResult>(result.Result);
        var apiResponse = Assert.IsType<ApiResponse<ConversationsResponse>>(badRequestResult.Value);
        Assert.False(apiResponse.Success);
    }

    [Fact]
    public async Task GetMyConversations_UserNotFound_ReturnsBadRequest()
    {
        // Arrange
        var userId = 1;
        var request = new ConversationsRequest
        {
            Status = ConversationStatus.Accepted,
            Page = 1,
            PageSize = 20
        };

        _mockUserCache.Setup(x => x.UserExistsAsync(userId))
            .ReturnsAsync(false);

        _mockResponseService
            .Setup(x => x.BadRequest<ConversationsResponse>("User not found"))
            .Returns(new BadRequestObjectResult(new ApiResponse<ConversationsResponse>
            {
                Success = false,
                Message = "User not found"
            }));

        // Act
        var result = await _controller.GetMyConversations(request);

        // Assert
        var badRequestResult = Assert.IsType<BadRequestObjectResult>(result.Result);
        var apiResponse = Assert.IsType<ApiResponse<ConversationsResponse>>(badRequestResult.Value);
        Assert.False(apiResponse.Success);
        Assert.Equal("User not found", apiResponse.Message);
    }

    [Fact]
    public async Task GetMyConversations_EmptyConversations_ReturnsEmptyList()
    {
        // Arrange
        var userId = 1;
        var request = new ConversationsRequest
        {
            Status = ConversationStatus.Accepted,
            Page = 1,
            PageSize = 20
        };

        _mockUserCache.Setup(x => x.UserExistsAsync(userId))
            .ReturnsAsync(true);

        var expectedResponse = new ConversationsResponse
        {
            Conversations = new List<ConversationDto>(),
            TotalCount = 0,
            PageSize = 20,
            CurrentPage = 1,
            HasMore = false
        };

        _mockConversationService
            .Setup(x => x.GetUserConversationsAsync(userId, It.IsAny<ConversationsRequest>()))
            .ReturnsAsync(expectedResponse);

        _mockResponseService
            .Setup(x => x.Success(expectedResponse, "Conversations received successfully"))
            .Returns(new OkObjectResult(new ApiResponse<ConversationsResponse>
            {
                Success = true,
                Data = expectedResponse
            }));

        // Act
        var result = await _controller.GetMyConversations(request);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var apiResponse = Assert.IsType<ApiResponse<ConversationsResponse>>(okResult.Value);
        Assert.True(apiResponse.Success);
        Assert.Empty(apiResponse.Data.Conversations);
        Assert.Equal(0, apiResponse.Data.TotalCount);
        Assert.False(apiResponse.Data.HasMore);
    }

    [Fact]
    public async Task GetMyConversations_Pagination_HasMoreIsTrue()
    {
        // Arrange
        var userId = 1;
        var request = new ConversationsRequest
        {
            Status = ConversationStatus.Accepted,
            Page = 1,
            PageSize = 10
        };

        _mockUserCache.Setup(x => x.UserExistsAsync(userId))
            .ReturnsAsync(true);

        var expectedResponse = new ConversationsResponse
        {
            Conversations = new List<ConversationDto>(Enumerable.Range(1, 10).Select(i => 
                new ConversationDto { Id = i })),
            TotalCount = 25,
            PageSize = 10,
            CurrentPage = 1,
            HasMore = true
        };

        _mockConversationService
            .Setup(x => x.GetUserConversationsAsync(userId, It.IsAny<ConversationsRequest>()))
            .ReturnsAsync(expectedResponse);

        _mockResponseService
            .Setup(x => x.Success(expectedResponse, "Conversations received successfully"))
            .Returns(new OkObjectResult(new ApiResponse<ConversationsResponse>
            {
                Success = true,
                Data = expectedResponse
            }));

        // Act
        var result = await _controller.GetMyConversations(request);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var apiResponse = Assert.IsType<ApiResponse<ConversationsResponse>>(okResult.Value);
        Assert.True(apiResponse.Data.HasMore);
        Assert.Equal(25, apiResponse.Data.TotalCount);
        Assert.Equal(10, apiResponse.Data.Conversations.Count);
    }

    [Theory]
    [InlineData(1, 20)]
    [InlineData(2, 10)]
    [InlineData(5, 5)]
    public async Task GetMyConversations_DifferentPaginationParams_ReturnsCorrectPage(int page, int pageSize)
    {
        // Arrange
        var userId = 1;
        var request = new ConversationsRequest
        {
            Status = ConversationStatus.Accepted,
            Page = page,
            PageSize = pageSize
        };

        _mockUserCache.Setup(x => x.UserExistsAsync(userId))
            .ReturnsAsync(true);

        var expectedResponse = new ConversationsResponse
        {
            Conversations = new List<ConversationDto>(),
            TotalCount = 100,
            PageSize = pageSize,
            CurrentPage = page,
            HasMore = (page * pageSize) < 100
        };

        _mockConversationService
            .Setup(x => x.GetUserConversationsAsync(userId, It.IsAny<ConversationsRequest>()))
            .ReturnsAsync(expectedResponse);

        _mockResponseService
            .Setup(x => x.Success(expectedResponse, "Conversations received successfully"))
            .Returns(new OkObjectResult(new ApiResponse<ConversationsResponse>
            {
                Success = true,
                Data = expectedResponse
            }));

        // Act
        var result = await _controller.GetMyConversations(request);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var apiResponse = Assert.IsType<ApiResponse<ConversationsResponse>>(okResult.Value);
        Assert.Equal(page, apiResponse.Data.CurrentPage);
        Assert.Equal(pageSize, apiResponse.Data.PageSize);
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
    }
}