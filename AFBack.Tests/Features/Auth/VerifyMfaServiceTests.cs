using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Configurations.Options;
using AFBack.Features.Auth.DTOs.Request;
using AFBack.Features.Auth.DTOs.Response;
using AFBack.Features.Auth.Enums;
using AFBack.Features.Auth.Models;
using AFBack.Features.Auth.Repositories;
using AFBack.Features.Auth.Services;
using AFBack.Features.Auth.Services.Interfaces;
using AFBack.Infrastructure.Email;
using AFBack.Infrastructure.Security.Enums;
using AFBack.Infrastructure.Security.Services;
using AFBack.Infrastructure.Transactions;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;

namespace AFBack.Tests.Features.Auth;

public class VerifyMfaServiceTests
{
    private readonly Mock<UserManager<AppUser>>       _userManager;
    private readonly Mock<IVerificationInfoService>   _verificationInfoService;
    private readonly Mock<ISuspiciousActivityService> _suspiciousActivity;
    private readonly Mock<IUserDeviceService>         _userDeviceService;
    private readonly Mock<ITokenService>              _tokenService;
    private readonly Mock<ILoginHistoryService>       _loginHistoryService;
    private readonly Mock<ITransactionService>        _transactionService;

    private const string Ip        = "10.0.0.1";
    private const string UserAgent = "TestAgent/1.0";

    private static readonly VerifyMfaRequest ValidRequest = new()
    {
        Email  = "bruker@test.no",
        Code   = "123456",
        Device = new DeviceInfoRequest
        {
            DeviceFingerprint = "fp-test",
            DeviceName        = "Test Device",
            DeviceType        = DeviceType.Unknown,
            OperatingSystem   = OperatingSystemType.Unknown,
        },
    };

    private static AppUser VerifiedUser() => new()
    {
        Id       = Guid.NewGuid().ToString(),
        Email    = ValidRequest.Email,
        UserName = ValidRequest.Email,
        EmailConfirmed       = true,
        PhoneNumberConfirmed = true,
        VerificationInfo     = new VerificationInfo(),
    };

    public VerifyMfaServiceTests()
    {
        var store = new Mock<IUserStore<AppUser>>();
        _userManager = new Mock<UserManager<AppUser>>(
            store.Object, null!, null!, null!, null!, null!, null!, null!, null!);

        _verificationInfoService = new Mock<IVerificationInfoService>();
        _suspiciousActivity      = new Mock<ISuspiciousActivityService>();
        _userDeviceService       = new Mock<IUserDeviceService>();
        _tokenService            = new Mock<ITokenService>();
        _loginHistoryService     = new Mock<ILoginHistoryService>();
        _transactionService      = new Mock<ITransactionService>();

        // Standard happy-path-oppsett — overstyres per test
        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync(VerifiedUser());

        _userManager
            .Setup(m => m.GetRolesAsync(It.IsAny<AppUser>()))
            .ReturnsAsync(new List<string> { "User" });

        _verificationInfoService
            .Setup(v => v.ValidateLoginMfaCodeAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success());

        _transactionService
            .Setup(t => t.ExecuteAsync(
                It.IsAny<Func<CancellationToken, Task<Result<LoginResponse>>>>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<string>()))
            .Returns<Func<CancellationToken, Task<Result<LoginResponse>>>, CancellationToken, string>(
                (fn, ct, _) => fn(ct));

        _userDeviceService
            .Setup(d => d.ResolveOrCreateDeviceAsync(
                It.IsAny<string>(), It.IsAny<DeviceInfoRequest>(),
                It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserDevice { Id = 1, DeviceName = "Test Device" });

        _tokenService
            .Setup(t => t.GenerateTokenPairAsync(
                It.IsAny<AppUser>(), It.IsAny<UserDevice>(), It.IsAny<IList<string>>(),
                It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new LoginResponse
            {
                AccessToken          = "access-token",
                RefreshToken         = "refresh-token",
                AccessTokenExpires   = DateTime.UtcNow.AddMinutes(15),
                RefreshTokenExpires  = DateTime.UtcNow.AddDays(365),
                User = new AFBack.Common.DTOs.UserSummaryDto
                {
                    Id = "user-id", FullName = "Test Bruker"
                }
            });
    }

    private AuthService BuildSut() => new(
        _userManager.Object,
        Mock.Of<ILogger<AuthService>>(),
        Mock.Of<IUserRepository>(),
        Mock.Of<IEmailService>(),
        Options.Create(new AppOptions { BaseUrl = "https://test.example.com" }),
        _verificationInfoService.Object,
        Mock.Of<IEmailRateLimitService>(),
        _userDeviceService.Object,
        _loginHistoryService.Object,
        Mock.Of<IAccountVerificationService>(),
        _suspiciousActivity.Object,
        Mock.Of<IVerificationInfoRepository>(),
        _tokenService.Object,
        Mock.Of<IRateLimitGuardService>(),
        _transactionService.Object);

    // ======================== Bruker ikke funnet ========================

    [Fact]
    public async Task VerifyMfaAsync_WhenUserNotFound_ShouldReturnUnauthorized()
    {
        // Arrange
        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync((AppUser?)null);

        var sut = BuildSut();

        // Act
        var result = await sut.VerifyMfaAsync(ValidRequest, Ip, UserAgent);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.Unauthorized);
        _verificationInfoService.Verify(
            v => v.ValidateLoginMfaCodeAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    // ======================== Ugyldig kode ========================

    [Fact]
    public async Task VerifyMfaAsync_WhenCodeIsInvalid_ShouldReturnInvalidCode()
    {
        // Arrange
        _verificationInfoService
            .Setup(v => v.ValidateLoginMfaCodeAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure("Invalid verification code", AppErrorCode.InvalidCode));

        var sut = BuildSut();

        // Act
        var result = await sut.VerifyMfaAsync(ValidRequest, Ip, UserAgent);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.InvalidCode);
        _suspiciousActivity.Verify(
            s => s.ReportSuspiciousActivityAsync(
                It.IsAny<string>(), It.IsAny<SuspiciousActivityType>(),
                It.IsAny<string>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()),
            Times.Never);
    }

    // ======================== Utløpt kode ========================

    [Fact]
    public async Task VerifyMfaAsync_WhenCodeIsExpired_ShouldReturnExpiredCode()
    {
        // Arrange
        _verificationInfoService
            .Setup(v => v.ValidateLoginMfaCodeAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure("Verification code has expired", AppErrorCode.ExpiredCode));

        var sut = BuildSut();

        // Act
        var result = await sut.VerifyMfaAsync(ValidRequest, Ip, UserAgent);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.ExpiredCode);
        _suspiciousActivity.Verify(
            s => s.ReportSuspiciousActivityAsync(
                It.IsAny<string>(), It.IsAny<SuspiciousActivityType>(),
                It.IsAny<string>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()),
            Times.Never);
    }

    // ======================== For mange forsøk — lockout ========================

    [Fact]
    public async Task VerifyMfaAsync_WhenLockedOutAfterTooManyAttempts_ShouldReportSuspiciousActivityAndReturnTooManyRequests()
    {
        // Arrange
        _verificationInfoService
            .Setup(v => v.ValidateLoginMfaCodeAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure(
                "Too many failed attempts. Please request a new verification code.",
                AppErrorCode.TooManyRequests));

        var sut = BuildSut();

        // Act
        var result = await sut.VerifyMfaAsync(ValidRequest, Ip, UserAgent);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.TooManyRequests);

        _suspiciousActivity.Verify(
            s => s.ReportSuspiciousActivityAsync(
                Ip,
                SuspiciousActivityType.BruteForceAttempt,
                It.Is<string>(r => r.Contains(ValidRequest.Email)),
                It.IsAny<string?>(),
                It.IsAny<string?>(),
                It.IsAny<string?>(),
                It.IsAny<string?>()),
            Times.Once);
    }

    // ======================== Happy path ========================

    [Fact]
    public async Task VerifyMfaAsync_WithValidCode_ShouldResolveDeviceGenerateTokensRecordLoginAndReturnResponse()
    {
        // Arrange
        var sut = BuildSut();

        // Act
        var result = await sut.VerifyMfaAsync(ValidRequest, Ip, UserAgent);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.AccessToken.Should().NotBeNullOrEmpty();
        result.Value.RefreshToken.Should().NotBeNullOrEmpty();
        result.Value.User.Should().NotBeNull();

        _userDeviceService.Verify(
            d => d.ResolveOrCreateDeviceAsync(
                It.IsAny<string>(), ValidRequest.Device,
                Ip, It.IsAny<CancellationToken>()),
            Times.Once);

        _tokenService.Verify(
            t => t.GenerateTokenPairAsync(
                It.IsAny<AppUser>(), It.IsAny<UserDevice>(), It.IsAny<IList<string>>(),
                Ip, UserAgent, It.IsAny<CancellationToken>()),
            Times.Once);

        _loginHistoryService.Verify(
            l => l.RecordLoginAsync(
                It.IsAny<string>(), It.IsAny<int>(),
                Ip, UserAgent, It.IsAny<CancellationToken>()),
            Times.Once);
    }
}
