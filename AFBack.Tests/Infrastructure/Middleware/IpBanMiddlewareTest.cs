using AFBack.Infrastructure.Middleware;
using AFBack.Interface.Services;
using AFBack.Models;
using AFBack.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;
using FluentAssertions;

namespace AFBack.Tests.Middleware;

public class IpBanMiddlewareTests
{
    private readonly Mock<IIpBanService> _mockIpBanService;
    private readonly Mock<ILogger<IpBanMiddleware>> _mockLogger;
    private readonly Mock<IServiceScopeFactory> _mockScopeFactory;
    private readonly Mock<RequestDelegate> _mockNext;

    public IpBanMiddlewareTests()
    {
        _mockIpBanService = new Mock<IIpBanService>();
        _mockLogger = new Mock<ILogger<IpBanMiddleware>>();
        _mockScopeFactory = new Mock<IServiceScopeFactory>();
        _mockNext = new Mock<RequestDelegate>();
    }

    [Fact]
    public async Task InvokeAsync_WhenIpNotBanned_ShouldCallNext()
    {
        // Arrange
        var middleware = new IpBanMiddleware(_mockNext.Object, _mockLogger.Object, _mockScopeFactory.Object);
        var context = CreateHttpContext();
        
        _mockIpBanService
            .Setup(s => s.IsIpOrDeviceBannedAsync(It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(false);

        // Act
        await middleware.InvokeAsync(context, _mockIpBanService.Object);

        // Assert
        _mockNext.Verify(n => n(context), Times.Once);
    }

    [Fact]
    public async Task InvokeAsync_WhenIpBanned_ShouldReturn403()
    {
        // Arrange
        var middleware = new IpBanMiddleware(_mockNext.Object, _mockLogger.Object, _mockScopeFactory.Object);
        var context = CreateHttpContext();
        
        _mockIpBanService
            .Setup(s => s.IsIpOrDeviceBannedAsync(It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(true);

        SetupMockScopeWithDbContext(); // ⬅️ Oppdatert

        // Act
        await middleware.InvokeAsync(context, _mockIpBanService.Object);

        // Assert
        _mockNext.Verify(n => n(context), Times.Never);
        context.Response.StatusCode.Should().Be(403);
    }

    [Fact]
    public async Task InvokeAsync_WhenDeviceBanned_ShouldReturn403()
    {
        // Arrange
        var middleware = new IpBanMiddleware(_mockNext.Object, _mockLogger.Object, _mockScopeFactory.Object);
        var context = CreateHttpContext();
        context.Request.Headers["X-Device-ID"] = "test-device-123";
        
        _mockIpBanService
            .Setup(s => s.IsIpOrDeviceBannedAsync(It.IsAny<string>(), "test-device-123"))
            .ReturnsAsync(true);

        SetupMockScopeWithDbContext(); // ⬅️ Oppdatert

        // Act
        await middleware.InvokeAsync(context, _mockIpBanService.Object);

        // Assert
        context.Response.StatusCode.Should().Be(403);
    }

    private HttpContext CreateHttpContext()
    {
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = System.Net.IPAddress.Parse("192.168.1.1");
        context.Response.Body = new MemoryStream();
        return context;
    }

    private void SetupMockScopeWithDbContext() // ⬅️ Oppdatert metode
    {
        // Create in-memory database
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        
        var dbContext = new ApplicationDbContext(options);
        
        // Mock scope and service provider
        var mockScope = new Mock<IServiceScope>();
        var mockServiceProvider = new Mock<IServiceProvider>();
        
        _mockScopeFactory
            .Setup(f => f.CreateScope())
            .Returns(mockScope.Object);
        
        mockScope
            .Setup(s => s.ServiceProvider)
            .Returns(mockServiceProvider.Object);
        
        mockServiceProvider
            .Setup(sp => sp.GetService(typeof(ApplicationDbContext)))
            .Returns(dbContext);
    }
}