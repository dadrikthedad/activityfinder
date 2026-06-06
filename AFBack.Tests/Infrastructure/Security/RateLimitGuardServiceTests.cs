using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Infrastructure.Email.Enums;
using AFBack.Infrastructure.Security.Enums;
using AFBack.Infrastructure.Security.Services;
using FluentAssertions;
using Moq;

namespace AFBack.Tests.Infrastructure.Security;

public class RateLimitGuardServiceTests
{
    private readonly Mock<IEmailRateLimitService>      _emailRateLimit;
    private readonly Mock<ISuspiciousActivityService>  _suspiciousActivity;
    private readonly RateLimitGuardService             _sut;

    private const string Email     = "test@test.no";
    private const string Ip        = "10.0.0.1";
    private const EmailType Type   = EmailType.Verification;

    public RateLimitGuardServiceTests()
    {
        _emailRateLimit     = new Mock<IEmailRateLimitService>();
        _suspiciousActivity = new Mock<ISuspiciousActivityService>();

        _sut = new RateLimitGuardService(
            _emailRateLimit.Object,
            Mock.Of<ISmsRateLimitService>(),
            _suspiciousActivity.Object);
    }

    [Fact]
    public async Task CheckEmailRateLimitAsync_WhenCanSendEmailSucceeds_ShouldReturnSuccess()
    {
        // Arrange
        _emailRateLimit
            .Setup(s => s.CanSendEmail(Type, Email, Ip))
            .Returns(Result.Success());

        // Act
        var result = await _sut.CheckEmailRateLimitAsync(Type, Email, Ip);

        // Assert
        result.IsSuccess.Should().BeTrue();
        _suspiciousActivity.Verify(
            s => s.ReportSuspiciousActivityAsync(
                It.IsAny<string>(), It.IsAny<SuspiciousActivityType>(), It.IsAny<string>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()),
            Times.Never);
    }

    [Fact]
    public async Task CheckEmailRateLimitAsync_WhenCanSendEmailFails_ShouldReportSuspiciousActivityAndReturnTooManyRequests()
    {
        // Arrange
        _emailRateLimit
            .Setup(s => s.CanSendEmail(Type, Email, Ip))
            .Returns(Result.Failure("Too many attempts.", AppErrorCode.TooManyRequests));

        // Act
        var result = await _sut.CheckEmailRateLimitAsync(Type, Email, Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.TooManyRequests);

        _suspiciousActivity.Verify(
            s => s.ReportSuspiciousActivityAsync(
                Ip,
                SuspiciousActivityType.EmailRateLimitExceeded,
                It.Is<string>(r => r.Contains(Email)),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()),
            Times.Once);
    }
}
