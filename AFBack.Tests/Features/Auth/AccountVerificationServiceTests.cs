using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Configurations.Options;
using AFBack.Features.Auth.Models;
using AFBack.Features.Auth.Services;
using AFBack.Features.Auth.Services.Interfaces;
using AFBack.Infrastructure.Email;
using AFBack.Infrastructure.Email.Enums;
using AFBack.Infrastructure.Email.Models;
using AFBack.Infrastructure.Security.Enums;
using AFBack.Infrastructure.Security.Services;
using AFBack.Infrastructure.Sms.Enums;
using AFBack.Infrastructure.Sms.Services;
using AFBack.Infrastructure.Transactions;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;

namespace AFBack.Tests.Features.Auth;

public class AccountVerificationServiceTests
{
    private readonly Mock<UserManager<AppUser>>         _userManager;
    private readonly Mock<IRateLimitGuardService>       _rateLimitGuard;
    private readonly Mock<IVerificationInfoService>     _verificationInfoService;
    private readonly Mock<IEmailService>                _emailService;
    private readonly Mock<ISmsService>                  _smsService;
    private readonly Mock<IEmailRateLimitService>       _emailRateLimitService;
    private readonly Mock<ISmsRateLimitService>         _smsRateLimitService;
    private readonly Mock<ITransactionService>          _transactionService;

    private const string Email = "bruker@test.no";
    private const string Phone = "+4799123456";
    private const string Ip    = "10.0.0.1";

    private static AppUser UnverifiedEmailUser() => new()
    {
        Id                   = Guid.NewGuid().ToString(),
        Email                = Email,
        UserName             = Email,
        PhoneNumber          = Phone,
        EmailConfirmed       = false,
        PhoneNumberConfirmed = true,
    };

    private static AppUser UnverifiedPhoneUser() => new()
    {
        Id                   = Guid.NewGuid().ToString(),
        Email                = Email,
        UserName             = Email,
        PhoneNumber          = Phone,
        EmailConfirmed       = true,
        PhoneNumberConfirmed = false,
    };

    public AccountVerificationServiceTests()
    {
        var store = new Mock<IUserStore<AppUser>>();
        _userManager = new Mock<UserManager<AppUser>>(
            store.Object, null!, null!, null!, null!, null!, null!, null!, null!);

        _rateLimitGuard          = new Mock<IRateLimitGuardService>();
        _verificationInfoService = new Mock<IVerificationInfoService>();
        _emailService            = new Mock<IEmailService>();
        _smsService              = new Mock<ISmsService>();
        _emailRateLimitService   = new Mock<IEmailRateLimitService>();
        _smsRateLimitService     = new Mock<ISmsRateLimitService>();
        _transactionService      = new Mock<ITransactionService>();

        // Standard happy-path-oppsett — overstyres per test
        _rateLimitGuard
            .Setup(r => r.CheckEmailRateLimitAsync(
                It.IsAny<EmailType>(), It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(Result.Success());

        _rateLimitGuard
            .Setup(r => r.CheckSmsRateLimitAsync(
                It.IsAny<SmsType>(), It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(Result.Success());

        _transactionService
            .Setup(t => t.ExecuteAsync(
                It.IsAny<Func<CancellationToken, Task<Result>>>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<string>()))
            .Returns<Func<CancellationToken, Task<Result>>, CancellationToken, string>(
                (fn, ct, _) => fn(ct));

        _verificationInfoService
            .Setup(v => v.GenerateEmailVerificationAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("123456");

        _verificationInfoService
            .Setup(v => v.GeneratePhoneVerificationAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("654321");

        _emailService
            .Setup(e => e.SendAsync(It.IsAny<string>(), It.IsAny<EmailBody>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success());

        _smsService
            .Setup(s => s.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success());
    }

    private AccountVerificationService BuildSut() => new(
        _userManager.Object,
        Mock.Of<ILogger<AccountVerificationService>>(),
        _verificationInfoService.Object,
        Options.Create(new AppOptions { BaseUrl = "https://test.example.com" }),
        _emailService.Object,
        _smsService.Object,
        _emailRateLimitService.Object,
        _smsRateLimitService.Object,
        Mock.Of<ISuspiciousActivityService>(),
        _rateLimitGuard.Object,
        _transactionService.Object);

    // ======================== ResendVerificationEmailAsync ========================

    [Fact]
    public async Task ResendVerificationEmailAsync_WhenRateLimitExceeded_ShouldReturnTooManyRequests()
    {
        // Arrange
        _rateLimitGuard
            .Setup(r => r.CheckEmailRateLimitAsync(
                It.IsAny<EmailType>(), It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(Result.Failure("For mange forsøk.", AppErrorCode.TooManyRequests));

        var sut = BuildSut();

        // Act
        var result = await sut.ResendVerificationEmailAsync(Email, Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.TooManyRequests);
        _userManager.Verify(m => m.FindByEmailAsync(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task ResendVerificationEmailAsync_WhenUserNotFound_ShouldReturnSuccessWithoutSendingEmail()
    {
        // Arrange — email enumeration-beskyttelse: avslør ikke at adressen ikke finnes
        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync((AppUser?)null);

        var sut = BuildSut();

        // Act
        var result = await sut.ResendVerificationEmailAsync(Email, Ip);

        // Assert
        result.IsSuccess.Should().BeTrue();
        _emailService.Verify(
            e => e.SendAsync(It.IsAny<string>(), It.IsAny<EmailBody>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ResendVerificationEmailAsync_WhenEmailAlreadyConfirmed_ShouldReturnSuccessWithoutSendingEmail()
    {
        // Arrange
        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync(new AppUser { Id = "id", Email = Email, EmailConfirmed = true });

        var sut = BuildSut();

        // Act
        var result = await sut.ResendVerificationEmailAsync(Email, Ip);

        // Assert
        result.IsSuccess.Should().BeTrue();
        _emailService.Verify(
            e => e.SendAsync(It.IsAny<string>(), It.IsAny<EmailBody>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ResendVerificationEmailAsync_WhenEmailSendFails_ShouldReturnFailure()
    {
        // Arrange
        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync(UnverifiedEmailUser());

        _emailService
            .Setup(e => e.SendAsync(It.IsAny<string>(), It.IsAny<EmailBody>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure("SMTP feil", AppErrorCode.InternalError));

        var sut = BuildSut();

        // Act
        var result = await sut.ResendVerificationEmailAsync(Email, Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
    }

    [Fact]
    public async Task ResendVerificationEmailAsync_WithUnverifiedUser_ShouldGenerateCodeAndSendEmail()
    {
        // Arrange
        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync(UnverifiedEmailUser());

        var sut = BuildSut();

        // Act
        var result = await sut.ResendVerificationEmailAsync(Email, Ip);

        // Assert
        result.IsSuccess.Should().BeTrue();

        _verificationInfoService.Verify(
            v => v.GenerateEmailVerificationAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Once);
        _emailService.Verify(
            e => e.SendAsync(Email, It.IsAny<EmailBody>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    // ======================== ResendPhoneVerificationAsync ========================

    [Fact]
    public async Task ResendPhoneVerificationAsync_WhenUserNotFound_ShouldReturnSuccessWithoutSendingSms()
    {
        // Arrange — phone enumeration-beskyttelse
        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync((AppUser?)null);

        var sut = BuildSut();

        // Act
        var result = await sut.ResendPhoneVerificationAsync(Email, Ip);

        // Assert
        result.IsSuccess.Should().BeTrue();
        _smsService.Verify(
            s => s.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ResendPhoneVerificationAsync_WhenPhoneAlreadyConfirmed_ShouldReturnSuccessWithoutSendingSms()
    {
        // Arrange
        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync(new AppUser
            {
                Id = "id", Email = Email, PhoneNumber = Phone,
                EmailConfirmed = true, PhoneNumberConfirmed = true,
            });

        var sut = BuildSut();

        // Act
        var result = await sut.ResendPhoneVerificationAsync(Email, Ip);

        // Assert
        result.IsSuccess.Should().BeTrue();
        _smsService.Verify(
            s => s.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ResendPhoneVerificationAsync_WhenRateLimitExceeded_ShouldReturnTooManyRequests()
    {
        // Arrange
        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync(UnverifiedPhoneUser());

        _rateLimitGuard
            .Setup(r => r.CheckSmsRateLimitAsync(
                It.IsAny<SmsType>(), It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(Result.Failure("For mange forsøk.", AppErrorCode.TooManyRequests));

        var sut = BuildSut();

        // Act
        var result = await sut.ResendPhoneVerificationAsync(Email, Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.TooManyRequests);
        _smsService.Verify(
            s => s.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ResendPhoneVerificationAsync_WhenSmsSendFails_ShouldReturnInternalError()
    {
        // Arrange
        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync(UnverifiedPhoneUser());

        _smsService
            .Setup(s => s.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure("SMS gateway feil", AppErrorCode.InternalError));

        var sut = BuildSut();

        // Act
        var result = await sut.ResendPhoneVerificationAsync(Email, Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.InternalError);
    }

    [Fact]
    public async Task ResendPhoneVerificationAsync_WithUnverifiedUser_ShouldGenerateCodeSendSmsAndRegisterSent()
    {
        // Arrange
        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync(UnverifiedPhoneUser());

        var sut = BuildSut();

        // Act
        var result = await sut.ResendPhoneVerificationAsync(Email, Ip);

        // Assert
        result.IsSuccess.Should().BeTrue();

        _verificationInfoService.Verify(
            v => v.GeneratePhoneVerificationAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Once);
        _smsService.Verify(
            s => s.SendAsync(Phone, It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Once);
        _smsRateLimitService.Verify(
            s => s.RegisterSmsSent(SmsType.Verification, Phone, Ip),
            Times.Once);
    }

    // ======================== VerifyEmailAsync ========================

    [Fact]
    public async Task VerifyEmailAsync_WhenUserNotFound_ShouldReturnUnauthorized()
    {
        // Arrange
        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync((AppUser?)null);

        var sut = BuildSut();

        // Act
        var result = await sut.VerifyEmailAsync(Email, "123456", Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.Unauthorized);
        _verificationInfoService.Verify(
            v => v.ValidateEmailCodeAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task VerifyEmailAsync_WhenEmailAlreadyConfirmed_ShouldReturnConflict()
    {
        // Arrange
        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync(new AppUser { Id = "id", Email = Email, EmailConfirmed = true });

        var sut = BuildSut();

        // Act
        var result = await sut.VerifyEmailAsync(Email, "123456", Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.Conflict);
    }

    [Fact]
    public async Task VerifyEmailAsync_WhenCodeIsInvalid_ShouldReturnInvalidCode()
    {
        // Arrange
        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync(UnverifiedEmailUser());

        _verificationInfoService
            .Setup(v => v.ValidateEmailCodeAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure("Invalid verification code", AppErrorCode.InvalidCode));

        var sut = BuildSut();

        // Act
        var result = await sut.VerifyEmailAsync(Email, "000000", Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.InvalidCode);
        _userManager.Verify(m => m.UpdateAsync(It.IsAny<AppUser>()), Times.Never);
    }

    [Fact]
    public async Task VerifyEmailAsync_WhenCodeIsExpired_ShouldReturnExpiredCode()
    {
        // Arrange
        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync(UnverifiedEmailUser());

        _verificationInfoService
            .Setup(v => v.ValidateEmailCodeAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure("Verification code has expired", AppErrorCode.ExpiredCode));

        var sut = BuildSut();

        // Act
        var result = await sut.VerifyEmailAsync(Email, "123456", Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.ExpiredCode);
    }

    [Fact]
    public async Task VerifyEmailAsync_WhenLockedOut_ShouldReportSuspiciousActivityAndReturnTooManyRequests()
    {
        // Arrange
        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync(UnverifiedEmailUser());

        _verificationInfoService
            .Setup(v => v.ValidateEmailCodeAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure(
                "Too many failed attempts. Please request a new verification code.",
                AppErrorCode.TooManyRequests));

        var mockSuspiciousActivity = new Mock<ISuspiciousActivityService>();
        var sut = new AccountVerificationService(
            _userManager.Object,
            Mock.Of<ILogger<AccountVerificationService>>(),
            _verificationInfoService.Object,
            Options.Create(new AppOptions { BaseUrl = "https://test.example.com" }),
            _emailService.Object,
            _smsService.Object,
            _emailRateLimitService.Object,
            _smsRateLimitService.Object,
            mockSuspiciousActivity.Object,
            _rateLimitGuard.Object,
            _transactionService.Object);

        // Act
        var result = await sut.VerifyEmailAsync(Email, "123456", Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.TooManyRequests);

        mockSuspiciousActivity.Verify(
            s => s.ReportSuspiciousActivityAsync(
                Ip,
                SuspiciousActivityType.BruteForceAttempt,
                It.Is<string>(r => r.Contains(Email)),
                It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>()),
            Times.Once);
    }

    [Fact]
    public async Task VerifyEmailAsync_WithValidCode_ShouldSetEmailConfirmedAndReturnSuccess()
    {
        // Arrange
        var user = UnverifiedEmailUser();
        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync(user);

        _verificationInfoService
            .Setup(v => v.ValidateEmailCodeAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success());

        _userManager
            .Setup(m => m.UpdateAsync(It.IsAny<AppUser>()))
            .ReturnsAsync(IdentityResult.Success);

        var sut = BuildSut();

        // Act
        var result = await sut.VerifyEmailAsync(Email, "123456", Ip);

        // Assert
        result.IsSuccess.Should().BeTrue();
        user.EmailConfirmed.Should().BeTrue();
        _userManager.Verify(m => m.UpdateAsync(user), Times.Once);
        _emailRateLimitService.Verify(
            r => r.ClearEmailAttempts(EmailType.Verification, Email),
            Times.Once);
    }

    // ======================== VerifyPhoneAsync ========================

    [Fact]
    public async Task VerifyPhoneAsync_WhenUserNotFound_ShouldReturnUnauthorized()
    {
        // Arrange
        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync((AppUser?)null);

        var sut = BuildSut();

        // Act
        var result = await sut.VerifyPhoneAsync(Email, "123456", Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.Unauthorized);
        _verificationInfoService.Verify(
            v => v.ValidatePhoneCodeAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task VerifyPhoneAsync_WhenPhoneAlreadyConfirmed_ShouldReturnConflict()
    {
        // Arrange
        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync(new AppUser
            {
                Id = "id", Email = Email, PhoneNumber = Phone,
                EmailConfirmed = true, PhoneNumberConfirmed = true,
            });

        var sut = BuildSut();

        // Act
        var result = await sut.VerifyPhoneAsync(Email, "123456", Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.Conflict);
    }

    [Fact]
    public async Task VerifyPhoneAsync_WhenCodeIsInvalid_ShouldReturnInvalidCode()
    {
        // Arrange
        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync(UnverifiedPhoneUser());

        _verificationInfoService
            .Setup(v => v.ValidatePhoneCodeAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure("Invalid verification code", AppErrorCode.InvalidCode));

        var sut = BuildSut();

        // Act
        var result = await sut.VerifyPhoneAsync(Email, "000000", Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.InvalidCode);
        _userManager.Verify(m => m.UpdateAsync(It.IsAny<AppUser>()), Times.Never);
    }

    [Fact]
    public async Task VerifyPhoneAsync_WhenCodeIsExpired_ShouldReturnExpiredCode()
    {
        // Arrange
        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync(UnverifiedPhoneUser());

        _verificationInfoService
            .Setup(v => v.ValidatePhoneCodeAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure("Verification code has expired", AppErrorCode.ExpiredCode));

        var sut = BuildSut();

        // Act
        var result = await sut.VerifyPhoneAsync(Email, "123456", Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.ExpiredCode);
    }

    [Fact]
    public async Task VerifyPhoneAsync_WhenLockedOut_ShouldReportSuspiciousActivityAndReturnTooManyRequests()
    {
        // Arrange
        var user = UnverifiedPhoneUser();
        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync(user);

        _verificationInfoService
            .Setup(v => v.ValidatePhoneCodeAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure(
                "Too many failed attempts. Please request a new verification code.",
                AppErrorCode.TooManyRequests));

        var mockSuspiciousActivity = new Mock<ISuspiciousActivityService>();
        var sut = new AccountVerificationService(
            _userManager.Object,
            Mock.Of<ILogger<AccountVerificationService>>(),
            _verificationInfoService.Object,
            Options.Create(new AppOptions { BaseUrl = "https://test.example.com" }),
            _emailService.Object,
            _smsService.Object,
            _emailRateLimitService.Object,
            _smsRateLimitService.Object,
            mockSuspiciousActivity.Object,
            _rateLimitGuard.Object,
            _transactionService.Object);

        // Act
        var result = await sut.VerifyPhoneAsync(Email, "123456", Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.TooManyRequests);

        mockSuspiciousActivity.Verify(
            s => s.ReportSuspiciousActivityAsync(
                Ip,
                SuspiciousActivityType.BruteForceAttempt,
                It.Is<string>(r => r.Contains(user.PhoneNumber!)),
                It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>()),
            Times.Once);
    }

    [Fact]
    public async Task VerifyPhoneAsync_WithValidCode_ShouldSetPhoneConfirmedAndClearSmsAttemptsAndReturnSuccess()
    {
        // Arrange
        var user = UnverifiedPhoneUser();
        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync(user);

        _verificationInfoService
            .Setup(v => v.ValidatePhoneCodeAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success());

        _userManager
            .Setup(m => m.UpdateAsync(It.IsAny<AppUser>()))
            .ReturnsAsync(IdentityResult.Success);

        var sut = BuildSut();

        // Act
        var result = await sut.VerifyPhoneAsync(Email, "654321", Ip);

        // Assert
        result.IsSuccess.Should().BeTrue();
        user.PhoneNumberConfirmed.Should().BeTrue();
        _userManager.Verify(m => m.UpdateAsync(user), Times.Once);
        _smsRateLimitService.Verify(
            r => r.ClearSmsAttempts(SmsType.Verification, user.PhoneNumber!),
            Times.Once);
    }
}
