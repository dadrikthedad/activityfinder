using AFBack.Common.Results;
using AFBack.Features.Geography.DTOs;
using AFBack.Features.Geography.Services;
using AFBack.Infrastructure.Security.Enums;
using AFBack.Infrastructure.Security.Models;
using AFBack.Infrastructure.Security.Repositories;
using AFBack.Infrastructure.Security.Services;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;

namespace AFBack.Tests.Infrastructure.Security;

public class SuspiciousActivityServiceTests
{
    private readonly Mock<IIpBanService>                    _ipBanService;
    private readonly Mock<IServiceScopeFactory>             _scopeFactory;
    private readonly Mock<IServiceScope>                    _scope;
    private readonly Mock<IServiceProvider>                 _serviceProvider;
    private readonly Mock<ISuspiciousActivityRepository>    _suspiciousRepo;
    private readonly Mock<IIpBanRepository>                 _ipBanRepo;
    private readonly Mock<IGeoLocationService>              _geoService;
    private readonly Mock<ILogger<SuspiciousActivityService>> _logger;
    private readonly SuspiciousActivityService              _sut;

    private const string ValidIp   = "10.0.0.1";
    private const string Reason    = "Test reason";
    private const SuspiciousActivityType ActivityType = SuspiciousActivityType.FailedLogin;

    public SuspiciousActivityServiceTests()
    {
        _ipBanService    = new Mock<IIpBanService>();
        _scopeFactory    = new Mock<IServiceScopeFactory>();
        _scope           = new Mock<IServiceScope>();
        _serviceProvider = new Mock<IServiceProvider>();
        _suspiciousRepo  = new Mock<ISuspiciousActivityRepository>();
        _ipBanRepo       = new Mock<IIpBanRepository>();
        _geoService      = new Mock<IGeoLocationService>();
        _logger          = new Mock<ILogger<SuspiciousActivityService>>();

        _scope.Setup(s => s.ServiceProvider).Returns(_serviceProvider.Object);
        _scopeFactory.Setup(f => f.CreateScope()).Returns(_scope.Object);

        _serviceProvider
            .Setup(p => p.GetService(typeof(ISuspiciousActivityRepository)))
            .Returns(_suspiciousRepo.Object);
        _serviceProvider
            .Setup(p => p.GetService(typeof(IIpBanRepository)))
            .Returns(_ipBanRepo.Object);

        _ipBanService.Setup(s => s.IsWhitelisted(It.IsAny<string>())).Returns(false);
        _ipBanService.Setup(s => s.IsIpBannedAsync(It.IsAny<string?>())).ReturnsAsync(false);

        _geoService
            .Setup(g => g.GetLocationAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<GeolocationResponse>.Failure("Geo failed", AFBack.Common.Enum.AppErrorCode.Unknown));

        _sut = new SuspiciousActivityService(
            _ipBanService.Object,
            _scopeFactory.Object,
            _logger.Object,
            _geoService.Object);
    }

    [Theory]
    [InlineData("not-an-ip")]
    [InlineData("999.999.999.999")]
    [InlineData("")]
    public async Task ReportSuspiciousActivityAsync_WhenInvalidIp_ShouldReturnEarlyWithNoDbCalls(string invalidIp)
    {
        // Act
        await _sut.ReportSuspiciousActivityAsync(invalidIp, ActivityType, Reason);

        // Assert
        _scopeFactory.Verify(f => f.CreateScope(), Times.Never);
        _ipBanService.Verify(s => s.IsIpBannedAsync(It.IsAny<string?>()), Times.Never);
    }

    [Fact]
    public async Task ReportSuspiciousActivityAsync_WhenIpIsWhitelisted_ShouldReturnEarlyWithNoDbCalls()
    {
        // Arrange
        _ipBanService.Setup(s => s.IsWhitelisted(ValidIp)).Returns(true);

        // Act
        await _sut.ReportSuspiciousActivityAsync(ValidIp, ActivityType, Reason);

        // Assert
        _ipBanService.Verify(s => s.IsIpBannedAsync(It.IsAny<string?>()), Times.Never);
        _scopeFactory.Verify(f => f.CreateScope(), Times.Never);
    }

    [Fact]
    public async Task ReportSuspiciousActivityAsync_WhenIpAlreadyBanned_ShouldReturnEarlyWithNoDbCalls()
    {
        // Arrange
        _ipBanService.Setup(s => s.IsIpBannedAsync(ValidIp)).ReturnsAsync(true);

        // Act
        await _sut.ReportSuspiciousActivityAsync(ValidIp, ActivityType, Reason);

        // Assert
        _scopeFactory.Verify(f => f.CreateScope(), Times.Never);
        _suspiciousRepo.Verify(r => r.AddSuspiciousActivity(It.IsAny<SuspiciousActivity>()), Times.Never);
    }

    [Fact]
    public async Task ReportSuspiciousActivityAsync_WhenUserDeviceNotFound_ShouldReturnEarlyWithNoDbCalls()
    {
        // Arrange
        const string userId = "user-guid";
        const string fingerprint = "device-fp";

        _ipBanRepo
            .Setup(r => r.GetUserDeviceIdAsync(userId, fingerprint))
            .ReturnsAsync((AFBack.Features.Auth.Models.UserDevice?)null);

        // Act
        await _sut.ReportSuspiciousActivityAsync(ValidIp, ActivityType, Reason,
            deviceFingerprint: fingerprint, userId: userId);

        // Assert
        _suspiciousRepo.Verify(r => r.AddSuspiciousActivity(It.IsAny<SuspiciousActivity>()), Times.Never);
    }

    [Fact]
    public async Task ReportSuspiciousActivityAsync_WhenBelowThreshold_ShouldSaveActivityWithoutBanning()
    {
        // Arrange
        _suspiciousRepo
            .Setup(r => r.GetSuspiciousActivitiesCountAsync(ValidIp, It.IsAny<DateTime>()))
            .ReturnsAsync(5); // under terskel på 20

        // Act
        await _sut.ReportSuspiciousActivityAsync(ValidIp, ActivityType, Reason);

        // Assert
        _suspiciousRepo.Verify(r => r.AddSuspiciousActivity(It.Is<SuspiciousActivity>(a =>
            a.IpAddress == ValidIp &&
            a.ActivityType == ActivityType &&
            a.Reason == Reason)), Times.Once);

        _ipBanService.Verify(s => s.BanIpAsync(
            It.IsAny<string>(), It.IsAny<BanType>(), It.IsAny<string>(),
            It.IsAny<string?>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task ReportSuspiciousActivityAsync_WhenAtOrAboveThreshold_ShouldSaveActivityAndBanIp()
    {
        // Arrange
        _suspiciousRepo
            .Setup(r => r.GetSuspiciousActivitiesCountAsync(ValidIp, It.IsAny<DateTime>()))
            .ReturnsAsync(20); // lik terskel

        // Act
        await _sut.ReportSuspiciousActivityAsync(ValidIp, ActivityType, Reason);

        // Assert
        _suspiciousRepo.Verify(r => r.AddSuspiciousActivity(It.IsAny<SuspiciousActivity>()), Times.Once);

        _ipBanService.Verify(s => s.BanIpAsync(
            ValidIp,
            BanType.Temporary,
            It.IsAny<string>(),
            It.IsAny<string?>(),
            It.IsAny<string>()), Times.Once);
    }

    [Fact]
    public async Task ReportSuspiciousActivityAsync_WhenGeoSucceeds_ShouldSetLocationOnActivity()
    {
        // Arrange
        var geoResponse = new GeolocationResponse { City = "Oslo", Region = "Oslo", Country = "Norway" };
        _geoService
            .Setup(g => g.GetLocationAsync(ValidIp, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<GeolocationResponse>.Success(geoResponse));

        _suspiciousRepo
            .Setup(r => r.GetSuspiciousActivitiesCountAsync(ValidIp, It.IsAny<DateTime>()))
            .ReturnsAsync(0);

        SuspiciousActivity? captured = null;
        _suspiciousRepo
            .Setup(r => r.AddSuspiciousActivity(It.IsAny<SuspiciousActivity>()))
            .Callback<SuspiciousActivity>(a => captured = a);

        // Act
        await _sut.ReportSuspiciousActivityAsync(ValidIp, ActivityType, Reason);

        // Assert
        captured.Should().NotBeNull();
        captured!.City.Should().Be("Oslo");
        captured.Region.Should().Be("Oslo");
        captured.Country.Should().Be("Norway");
    }

    [Fact]
    public async Task ReportSuspiciousActivityAsync_WhenGeoFails_ShouldSaveActivityWithNullLocation()
    {
        // Arrange — geo-service returnerer feil (standard i konstruktøren)
        _suspiciousRepo
            .Setup(r => r.GetSuspiciousActivitiesCountAsync(ValidIp, It.IsAny<DateTime>()))
            .ReturnsAsync(0);

        SuspiciousActivity? captured = null;
        _suspiciousRepo
            .Setup(r => r.AddSuspiciousActivity(It.IsAny<SuspiciousActivity>()))
            .Callback<SuspiciousActivity>(a => captured = a);

        // Act
        await _sut.ReportSuspiciousActivityAsync(ValidIp, ActivityType, Reason);

        // Assert
        captured.Should().NotBeNull();
        captured!.City.Should().BeNull();
        captured.Region.Should().BeNull();
        captured.Country.Should().BeNull();
    }

    [Fact]
    public async Task ReportSuspiciousActivityAsync_WhenOptionalFieldsProvided_ShouldPersistThemOnActivity()
    {
        // Arrange
        const string userAgent = "Mozilla/5.0";
        const string endpoint  = "/api/auth/login";

        _suspiciousRepo
            .Setup(r => r.GetSuspiciousActivitiesCountAsync(ValidIp, It.IsAny<DateTime>()))
            .ReturnsAsync(0);

        SuspiciousActivity? captured = null;
        _suspiciousRepo
            .Setup(r => r.AddSuspiciousActivity(It.IsAny<SuspiciousActivity>()))
            .Callback<SuspiciousActivity>(a => captured = a);

        // Act
        await _sut.ReportSuspiciousActivityAsync(ValidIp, ActivityType, Reason,
            userAgent: userAgent, endpoint: endpoint);

        // Assert
        captured.Should().NotBeNull();
        captured!.UserAgent.Should().Be(userAgent);
        captured.Endpoint.Should().Be(endpoint);
    }
}
