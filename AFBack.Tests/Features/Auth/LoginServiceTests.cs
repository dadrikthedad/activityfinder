using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Configurations.Options;
using AFBack.Features.Auth.DTOs.Request;
using AFBack.Features.Auth.Enums;
using AFBack.Features.Auth.Models;
using AFBack.Features.Auth.Repositories;
using AFBack.Features.Auth.Services;
using AFBack.Features.Auth.Services.Interfaces;
using AFBack.Infrastructure.Email;
using AFBack.Infrastructure.Email.Models;
using AFBack.Infrastructure.Security.Enums;
using AFBack.Infrastructure.Security.Services;
using AFBack.Infrastructure.Transactions;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;

namespace AFBack.Tests.Features.Auth;

public class LoginServiceTests
{
    private readonly Mock<UserManager<AppUser>>         _userManager;
    private readonly Mock<IAccountVerificationService>  _accountVerification;
    private readonly Mock<ISuspiciousActivityService>   _suspiciousActivity;
    private readonly Mock<IVerificationInfoService>     _verificationInfoService;
    private readonly Mock<IEmailService>                _emailService;
    private readonly Mock<ITransactionService>          _transactionService;

    private const string Ip = "10.0.0.1";

    private static readonly LoginRequest ValidRequest = new()
    {
        Email    = "bruker@test.no",
        Password = "TestPass123!",
        Device   = new DeviceInfoRequest
        {
            DeviceFingerprint = "fp-test",
            DeviceName        = "Test Device",
            DeviceType        = DeviceType.Unknown,
            OperatingSystem   = OperatingSystemType.Unknown,
        },
    };

    private static AppUser VerifiedUser() => new()
    {
        Id                   = Guid.NewGuid().ToString(),
        Email                = ValidRequest.Email,
        UserName             = ValidRequest.Email,
        EmailConfirmed       = true,
        PhoneNumberConfirmed = true,
        VerificationInfo     = new VerificationInfo(),
    };

    public LoginServiceTests()
    {
        var store = new Mock<IUserStore<AppUser>>();
        _userManager = new Mock<UserManager<AppUser>>(
            store.Object, null!, null!, null!, null!, null!, null!, null!, null!);

        _accountVerification     = new Mock<IAccountVerificationService>();
        _suspiciousActivity      = new Mock<ISuspiciousActivityService>();
        _verificationInfoService = new Mock<IVerificationInfoService>();
        _emailService            = new Mock<IEmailService>();
        _transactionService      = new Mock<ITransactionService>();

        // Standard happy-path-oppsett — overstyres per test
        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync(VerifiedUser());

        _userManager
            .Setup(m => m.IsLockedOutAsync(It.IsAny<AppUser>()))
            .ReturnsAsync(false);

        _userManager
            .Setup(m => m.CheckPasswordAsync(It.IsAny<AppUser>(), It.IsAny<string>()))
            .ReturnsAsync(true);

        _userManager
            .Setup(m => m.ResetAccessFailedCountAsync(It.IsAny<AppUser>()))
            .ReturnsAsync(IdentityResult.Success);

        _transactionService
            .Setup(t => t.ExecuteAsync(
                It.IsAny<Func<CancellationToken, Task<Result>>>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<string>()))
            .Returns<Func<CancellationToken, Task<Result>>, CancellationToken, string>(
                (fn, ct, _) => fn(ct));

        _verificationInfoService
            .Setup(v => v.GenerateLoginMfaCodeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("123456");

        _emailService
            .Setup(e => e.SendAsync(It.IsAny<string>(), It.IsAny<EmailBody>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success());
    }

    private AuthService BuildSut() => new(
        _userManager.Object,
        Mock.Of<ILogger<AuthService>>(),
        Mock.Of<IUserRepository>(),
        _emailService.Object,
        Options.Create(new AppOptions { BaseUrl = "https://test.example.com" }),
        _verificationInfoService.Object,
        Mock.Of<IEmailRateLimitService>(),
        Mock.Of<IUserDeviceService>(),
        Mock.Of<ILoginHistoryService>(),
        _accountVerification.Object,
        _suspiciousActivity.Object,
        Mock.Of<IVerificationInfoRepository>(),
        Mock.Of<ITokenService>(),
        Mock.Of<IRateLimitGuardService>(),
        _transactionService.Object);

    // ======================== Ukjent bruker ========================

    [Fact]
    public async Task LoginAsync_WhenUserNotFound_ShouldReturnInvalidCredentials()
    {
        // Arrange
        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync((AppUser?)null);

        var sut = BuildSut();

        // Act
        var result = await sut.LoginAsync(ValidRequest, Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.InvalidCredentials);
    }

    // ======================== Konto låst ========================

    [Fact]
    public async Task LoginAsync_WhenAccountAlreadyLocked_ShouldReturnAccountLocked()
    {
        // Arrange
        _userManager
            .Setup(m => m.IsLockedOutAsync(It.IsAny<AppUser>()))
            .ReturnsAsync(true);

        var sut = BuildSut();

        // Act
        var result = await sut.LoginAsync(ValidRequest, Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.AccountLocked);
    }

    // ======================== Feil passord ========================

    [Fact]
    public async Task LoginAsync_WhenPasswordIsWrong_ShouldIncrementAccessFailedCountAndReturnInvalidCredentials()
    {
        // Arrange
        _userManager
            .Setup(m => m.CheckPasswordAsync(It.IsAny<AppUser>(), It.IsAny<string>()))
            .ReturnsAsync(false);

        _userManager
            .Setup(m => m.AccessFailedAsync(It.IsAny<AppUser>()))
            .ReturnsAsync(IdentityResult.Success);

        // Ikke låst etter dette forsøket
        _userManager
            .SetupSequence(m => m.IsLockedOutAsync(It.IsAny<AppUser>()))
            .ReturnsAsync(false)   // Første kall: lockout-sjekk før passord-validering
            .ReturnsAsync(false);  // Andre kall: sjekk etter AccessFailedAsync

        var sut = BuildSut();

        // Act
        var result = await sut.LoginAsync(ValidRequest, Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.InvalidCredentials);

        _userManager.Verify(m => m.AccessFailedAsync(It.IsAny<AppUser>()), Times.Once);
        _suspiciousActivity.Verify(
            s => s.ReportSuspiciousActivityAsync(
                It.IsAny<string>(), It.IsAny<SuspiciousActivityType>(), It.IsAny<string>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()),
            Times.Never);
    }

    [Fact]
    public async Task LoginAsync_WhenPasswordWrongAndLockoutTriggered_ShouldReportSuspiciousActivityAndReturnInvalidCredentials()
    {
        // Arrange
        _userManager
            .Setup(m => m.CheckPasswordAsync(It.IsAny<AppUser>(), It.IsAny<string>()))
            .ReturnsAsync(false);

        _userManager
            .Setup(m => m.AccessFailedAsync(It.IsAny<AppUser>()))
            .ReturnsAsync(IdentityResult.Success);

        _userManager
            .SetupSequence(m => m.IsLockedOutAsync(It.IsAny<AppUser>()))
            .ReturnsAsync(false)  // Første kall: før passord-validering — ikke låst ennå
            .ReturnsAsync(true);  // Andre kall: etter AccessFailedAsync — nettopp låst

        var sut = BuildSut();

        // Act
        var result = await sut.LoginAsync(ValidRequest, Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.InvalidCredentials);

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

    // ======================== Verifisering ========================

    [Fact]
    public async Task LoginAsync_WhenEmailNotConfirmed_ShouldResendVerificationEmailAndReturnEmailNotConfirmed()
    {
        // Arrange
        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync(new AppUser
            {
                Id = Guid.NewGuid().ToString(),
                Email = ValidRequest.Email,
                UserName = ValidRequest.Email,
                EmailConfirmed = false,
                PhoneNumberConfirmed = true,
                VerificationInfo = new VerificationInfo(),
            });

        _accountVerification
            .Setup(a => a.ResendVerificationEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success());

        var sut = BuildSut();

        // Act
        var result = await sut.LoginAsync(ValidRequest, Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.EmailNotConfirmed);

        _accountVerification.Verify(
            a => a.ResendVerificationEmailAsync(ValidRequest.Email, Ip, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task LoginAsync_WhenPhoneNotConfirmed_ShouldResendSmsAndReturnPhoneNotConfirmed()
    {
        // Arrange
        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync(new AppUser
            {
                Id = Guid.NewGuid().ToString(),
                Email = ValidRequest.Email,
                UserName = ValidRequest.Email,
                EmailConfirmed = true,
                PhoneNumberConfirmed = false,
                VerificationInfo = new VerificationInfo(),
            });

        _accountVerification
            .Setup(a => a.ResendPhoneVerificationAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success());

        var sut = BuildSut();

        // Act
        var result = await sut.LoginAsync(ValidRequest, Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.PhoneNotConfirmed);

        _accountVerification.Verify(
            a => a.ResendPhoneVerificationAsync(ValidRequest.Email, Ip, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    // ======================== MFA-epost ========================

    [Fact]
    public async Task LoginAsync_WhenMfaEmailFails_ShouldReturnInternalError()
    {
        // Arrange
        _emailService
            .Setup(e => e.SendAsync(It.IsAny<string>(), It.IsAny<EmailBody>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure("SMTP feil", AppErrorCode.InternalError));

        var sut = BuildSut();

        // Act
        var result = await sut.LoginAsync(ValidRequest, Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.InternalError);
    }

    // ======================== Happy path ========================

    [Fact]
    public async Task LoginAsync_WithValidCredentials_ShouldResetAccessFailedCountAndReturnSuccess()
    {
        // Arrange
        var sut = BuildSut();

        // Act
        var result = await sut.LoginAsync(ValidRequest, Ip);

        // Assert
        result.IsSuccess.Should().BeTrue();

        _userManager.Verify(m => m.ResetAccessFailedCountAsync(It.IsAny<AppUser>()), Times.Once);
        _verificationInfoService.Verify(
            v => v.GenerateLoginMfaCodeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Once);
        _emailService.Verify(
            e => e.SendAsync(It.IsAny<string>(), It.IsAny<EmailBody>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }
}
