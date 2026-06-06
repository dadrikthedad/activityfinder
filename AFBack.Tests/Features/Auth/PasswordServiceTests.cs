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

public class PasswordServiceTests
{
    private readonly Mock<UserManager<AppUser>>           _userManager;
    private readonly Mock<IVerificationInfoService>       _verificationInfoService;
    private readonly Mock<IAccountVerificationService>    _accountVerificationService;
    private readonly Mock<IEmailService>                  _emailService;
    private readonly Mock<ISmsService>                    _smsService;
    private readonly Mock<IEmailRateLimitService>         _emailRateLimitService;
    private readonly Mock<ISmsRateLimitService>           _smsRateLimitService;
    private readonly Mock<ISuspiciousActivityService>     _suspiciousActivity;
    private readonly Mock<IRateLimitGuardService>         _rateLimitGuardService;
    private readonly Mock<ITransactionService>            _transactionService;

    private const string Email     = "bruker@test.no";
    private const string Ip        = "10.0.0.1";
    private const string Phone     = "+4799887766";

    private static AppUser VerifiedUser(string? phone = null) => new()
    {
        Id                   = Guid.NewGuid().ToString(),
        Email                = Email,
        UserName             = Email,
        PhoneNumber          = phone ?? Phone,
        EmailConfirmed       = true,
        PhoneNumberConfirmed = true,
    };

    public PasswordServiceTests()
    {
        var store = new Mock<IUserStore<AppUser>>();
        _userManager = new Mock<UserManager<AppUser>>(
            store.Object, null!, null!, null!, null!, null!, null!, null!, null!);

        _verificationInfoService    = new Mock<IVerificationInfoService>();
        _accountVerificationService = new Mock<IAccountVerificationService>();
        _emailService               = new Mock<IEmailService>();
        _smsService                 = new Mock<ISmsService>();
        _emailRateLimitService      = new Mock<IEmailRateLimitService>();
        _smsRateLimitService        = new Mock<ISmsRateLimitService>();
        _suspiciousActivity         = new Mock<ISuspiciousActivityService>();
        _rateLimitGuardService      = new Mock<IRateLimitGuardService>();
        _transactionService         = new Mock<ITransactionService>();

        // Standard happy-path-oppsett — overstyres per test
        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync(VerifiedUser());

        _rateLimitGuardService
            .Setup(r => r.CheckEmailRateLimitAsync(
                It.IsAny<EmailType>(), It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(Result.Success());

        _rateLimitGuardService
            .Setup(r => r.CheckSmsRateLimitAsync(
                It.IsAny<SmsType>(), It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(Result.Success());

        _emailService
            .Setup(e => e.SendAsync(It.IsAny<string>(), It.IsAny<EmailBody>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success());

        _smsService
            .Setup(s => s.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success());

        _verificationInfoService
            .Setup(v => v.GenerateEmailPasswordResetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("123456");

        _verificationInfoService
            .Setup(v => v.GenerateSmsPasswordResetCodeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("654321");

        _verificationInfoService
            .Setup(v => v.ValidateEmailPasswordResetCodeAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success());

        _verificationInfoService
            .Setup(v => v.ValidateSmsPasswordResetCodeAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success());

        _verificationInfoService
            .Setup(v => v.IsSmsPasswordResetVerifiedAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success());

        _accountVerificationService
            .Setup(a => a.ResendVerificationEmailAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success());

        _accountVerificationService
            .Setup(a => a.ResendPhoneVerificationAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success());

        _transactionService
            .Setup(t => t.ExecuteAsync(
                It.IsAny<Func<CancellationToken, Task<Result>>>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<string>()))
            .Returns<Func<CancellationToken, Task<Result>>, CancellationToken, string>(
                (fn, ct, _) => fn(ct));

        _userManager
            .Setup(m => m.RemovePasswordAsync(It.IsAny<AppUser>()))
            .ReturnsAsync(IdentityResult.Success);

        _userManager
            .Setup(m => m.AddPasswordAsync(It.IsAny<AppUser>(), It.IsAny<string>()))
            .ReturnsAsync(IdentityResult.Success);

        _userManager
            .Setup(m => m.IsLockedOutAsync(It.IsAny<AppUser>()))
            .ReturnsAsync(false);
    }

    private PasswordService BuildSut() => new(
        _userManager.Object,
        Mock.Of<ILogger<PasswordService>>(),
        Options.Create(new AppOptions { BaseUrl = "https://test.example.com" }),
        _verificationInfoService.Object,
        _accountVerificationService.Object,
        _emailService.Object,
        _smsService.Object,
        _emailRateLimitService.Object,
        _smsRateLimitService.Object,
        _suspiciousActivity.Object,
        _rateLimitGuardService.Object,
        _transactionService.Object);

    // ======================== ForgotPasswordAsync ========================

    [Fact]
    public async Task ForgotPasswordAsync_WhenEmailRateLimited_ShouldReturnTooManyRequests()
    {
        // Arrange
        _rateLimitGuardService
            .Setup(r => r.CheckEmailRateLimitAsync(EmailType.PasswordReset, Email, Ip))
            .ReturnsAsync(Result.Failure("Rate limit exceeded", AppErrorCode.TooManyRequests));

        var sut = BuildSut();

        // Act
        var result = await sut.ForgotPasswordAsync(Email, Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.TooManyRequests);
        _emailService.Verify(
            e => e.SendAsync(It.IsAny<string>(), It.IsAny<EmailBody>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ForgotPasswordAsync_WhenUserNotFound_ShouldReturnSuccessSilently()
    {
        // Arrange — anti-enumeration: returnerer alltid 200 OK
        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync((AppUser?)null);

        var sut = BuildSut();

        // Act
        var result = await sut.ForgotPasswordAsync("finnesikke@test.no", Ip);

        // Assert
        result.IsSuccess.Should().BeTrue();
        _emailService.Verify(
            e => e.SendAsync(It.IsAny<string>(), It.IsAny<EmailBody>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ForgotPasswordAsync_WhenEmailNotConfirmed_ShouldResendVerificationAndReturnEmailNotConfirmed()
    {
        // Arrange
        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync(new AppUser
            {
                Id = Guid.NewGuid().ToString(), Email = Email, UserName = Email,
                EmailConfirmed = false, PhoneNumberConfirmed = true,
            });

        var sut = BuildSut();

        // Act
        var result = await sut.ForgotPasswordAsync(Email, Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.EmailNotConfirmed);

        _accountVerificationService.Verify(
            a => a.ResendVerificationEmailAsync(Email, Ip, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task ForgotPasswordAsync_WhenPhoneNotConfirmed_ShouldResendSmsAndReturnPhoneNotConfirmed()
    {
        // Arrange
        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync(new AppUser
            {
                Id = Guid.NewGuid().ToString(), Email = Email, UserName = Email,
                EmailConfirmed = true, PhoneNumberConfirmed = false,
            });

        var sut = BuildSut();

        // Act
        var result = await sut.ForgotPasswordAsync(Email, Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.PhoneNotConfirmed);

        _accountVerificationService.Verify(
            a => a.ResendPhoneVerificationAsync(Email, Ip, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task ForgotPasswordAsync_WhenEmailServiceFails_ShouldReturnInternalError()
    {
        // Arrange
        _emailService
            .Setup(e => e.SendAsync(It.IsAny<string>(), It.IsAny<EmailBody>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure("SMTP feil", AppErrorCode.InternalError));

        var sut = BuildSut();

        // Act
        var result = await sut.ForgotPasswordAsync(Email, Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.InternalError);

        // Rate limit skal ikke registreres når e-posten ikke ble sendt
        _emailRateLimitService.Verify(
            r => r.RegisterEmailSent(It.IsAny<EmailType>(), It.IsAny<string>(), It.IsAny<string>()),
            Times.Never);
    }

    [Fact]
    public async Task ForgotPasswordAsync_WhenSuccessful_ShouldGenerateCodeSendEmailAndRegisterSent()
    {
        // Arrange
        var sut = BuildSut();

        // Act
        var result = await sut.ForgotPasswordAsync(Email, Ip);

        // Assert
        result.IsSuccess.Should().BeTrue();

        _verificationInfoService.Verify(
            v => v.GenerateEmailPasswordResetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Once);

        _emailService.Verify(
            e => e.SendAsync(Email, It.IsAny<EmailBody>(), It.IsAny<CancellationToken>()),
            Times.Once);

        _emailRateLimitService.Verify(
            r => r.RegisterEmailSent(EmailType.PasswordReset, Email, Ip),
            Times.Once);
    }

    // ======================== VerifyPasswordResetEmailCodeAsync ========================

    [Fact]
    public async Task VerifyPasswordResetEmailCodeAsync_WhenUserNotFound_ShouldReturnUnauthorized()
    {
        // Arrange
        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync((AppUser?)null);

        var sut = BuildSut();

        // Act
        var result = await sut.VerifyPasswordResetEmailCodeAsync("finnesikke@test.no", "123456", Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.Unauthorized);
        _verificationInfoService.Verify(
            v => v.ValidateEmailPasswordResetCodeAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task VerifyPasswordResetEmailCodeAsync_WhenCodeIsInvalid_ShouldReturnInvalidCodeWithoutSuspiciousActivity()
    {
        // Arrange
        _verificationInfoService
            .Setup(v => v.ValidateEmailPasswordResetCodeAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure("Invalid code", AppErrorCode.InvalidCode));

        var sut = BuildSut();

        // Act
        var result = await sut.VerifyPasswordResetEmailCodeAsync(Email, "000000", Ip);

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

    [Fact]
    public async Task VerifyPasswordResetEmailCodeAsync_WhenCodeIsExpired_ShouldReturnExpiredCodeWithoutSuspiciousActivity()
    {
        // Arrange
        _verificationInfoService
            .Setup(v => v.ValidateEmailPasswordResetCodeAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure("Code expired", AppErrorCode.ExpiredCode));

        var sut = BuildSut();

        // Act
        var result = await sut.VerifyPasswordResetEmailCodeAsync(Email, "123456", Ip);

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

    [Fact]
    public async Task VerifyPasswordResetEmailCodeAsync_WhenLockedOut_ShouldReportSuspiciousActivityAndReturnTooManyRequests()
    {
        // Arrange
        _verificationInfoService
            .Setup(v => v.ValidateEmailPasswordResetCodeAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure("Too many attempts", AppErrorCode.TooManyRequests));

        var sut = BuildSut();

        // Act
        var result = await sut.VerifyPasswordResetEmailCodeAsync(Email, "123456", Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.TooManyRequests);

        _suspiciousActivity.Verify(
            s => s.ReportSuspiciousActivityAsync(
                Ip,
                SuspiciousActivityType.BruteForceAttempt,
                It.Is<string>(r => r.Contains(Email)),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()),
            Times.Once);
    }

    [Fact]
    public async Task VerifyPasswordResetEmailCodeAsync_WhenCodeIsValid_ShouldReturnSuccess()
    {
        // Arrange
        var sut = BuildSut();

        // Act
        var result = await sut.VerifyPasswordResetEmailCodeAsync(Email, "123456", Ip);

        // Assert
        result.IsSuccess.Should().BeTrue();
    }

    // ======================== SendPasswordResetSmsAsync ========================

    [Fact]
    public async Task SendPasswordResetSmsAsync_WhenUserNotFound_ShouldReturnUnauthorized()
    {
        // Arrange
        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync((AppUser?)null);

        var sut = BuildSut();

        // Act
        var result = await sut.SendPasswordResetSmsAsync("finnesikke@test.no", Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.Unauthorized);
        _smsService.Verify(
            s => s.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task SendPasswordResetSmsAsync_WhenSmsRateLimited_ShouldReturnTooManyRequests()
    {
        // Arrange
        _rateLimitGuardService
            .Setup(r => r.CheckSmsRateLimitAsync(SmsType.PasswordReset, Phone, Ip))
            .ReturnsAsync(Result.Failure("Rate limit exceeded", AppErrorCode.TooManyRequests));

        var sut = BuildSut();

        // Act
        var result = await sut.SendPasswordResetSmsAsync(Email, Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.TooManyRequests);
        _smsService.Verify(
            s => s.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task SendPasswordResetSmsAsync_WhenSmsServiceFails_ShouldReturnInternalError()
    {
        // Arrange
        _smsService
            .Setup(s => s.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure("SMS feil", AppErrorCode.InternalError));

        var sut = BuildSut();

        // Act
        var result = await sut.SendPasswordResetSmsAsync(Email, Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.InternalError);
        _smsRateLimitService.Verify(
            r => r.RegisterSmsSent(It.IsAny<SmsType>(), It.IsAny<string>(), It.IsAny<string?>()),
            Times.Never);
    }

    [Fact]
    public async Task SendPasswordResetSmsAsync_WhenSuccessful_ShouldGenerateCodeSendSmsAndRegisterSent()
    {
        // Arrange
        var sut = BuildSut();

        // Act
        var result = await sut.SendPasswordResetSmsAsync(Email, Ip);

        // Assert
        result.IsSuccess.Should().BeTrue();

        _verificationInfoService.Verify(
            v => v.GenerateSmsPasswordResetCodeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Once);

        _smsService.Verify(
            s => s.SendAsync(Phone, It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Once);

        _smsRateLimitService.Verify(
            r => r.RegisterSmsSent(SmsType.PasswordReset, Phone, Ip),
            Times.Once);
    }

    // ======================== VerifyPasswordResetSmsAsync ========================

    [Fact]
    public async Task VerifyPasswordResetSmsAsync_WhenUserNotFound_ShouldReturnUnauthorized()
    {
        // Arrange
        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync((AppUser?)null);

        var sut = BuildSut();

        // Act
        var result = await sut.VerifyPasswordResetSmsAsync("finnesikke@test.no", "123456", Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.Unauthorized);
    }

    [Fact]
    public async Task VerifyPasswordResetSmsAsync_WhenCodeIsInvalid_ShouldReturnInvalidCodeWithoutSuspiciousActivity()
    {
        // Arrange
        _verificationInfoService
            .Setup(v => v.ValidateSmsPasswordResetCodeAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure("Invalid code", AppErrorCode.InvalidCode));

        var sut = BuildSut();

        // Act
        var result = await sut.VerifyPasswordResetSmsAsync(Email, "000000", Ip);

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

    [Fact]
    public async Task VerifyPasswordResetSmsAsync_WhenCodeIsExpired_ShouldReturnExpiredCodeWithoutSuspiciousActivity()
    {
        // Arrange
        _verificationInfoService
            .Setup(v => v.ValidateSmsPasswordResetCodeAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure("Code expired", AppErrorCode.ExpiredCode));

        var sut = BuildSut();

        // Act
        var result = await sut.VerifyPasswordResetSmsAsync(Email, "123456", Ip);

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

    [Fact]
    public async Task VerifyPasswordResetSmsAsync_WhenLockedOut_ShouldReportSuspiciousActivityAndReturnTooManyRequests()
    {
        // Arrange
        _verificationInfoService
            .Setup(v => v.ValidateSmsPasswordResetCodeAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure("Too many attempts", AppErrorCode.TooManyRequests));

        var sut = BuildSut();

        // Act
        var result = await sut.VerifyPasswordResetSmsAsync(Email, "123456", Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.TooManyRequests);

        _suspiciousActivity.Verify(
            s => s.ReportSuspiciousActivityAsync(
                Ip,
                SuspiciousActivityType.BruteForceAttempt,
                It.Is<string>(r => r.Contains(Email)),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()),
            Times.Once);
    }

    [Fact]
    public async Task VerifyPasswordResetSmsAsync_WhenCodeIsValid_ShouldReturnSuccess()
    {
        // Arrange
        var sut = BuildSut();

        // Act
        var result = await sut.VerifyPasswordResetSmsAsync(Email, "654321", Ip);

        // Assert
        result.IsSuccess.Should().BeTrue();
    }

    // ======================== ResetPasswordAsync ========================

    [Fact]
    public async Task ResetPasswordAsync_WhenUserNotFound_ShouldReturnUnauthorized()
    {
        // Arrange
        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync((AppUser?)null);

        var sut = BuildSut();

        // Act
        var result = await sut.ResetPasswordAsync("finnesikke@test.no", "NyttPassord123!", Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.Unauthorized);
    }

    [Fact]
    public async Task ResetPasswordAsync_WhenSmsSessionNotVerified_ShouldReturnResetSessionNotVerified()
    {
        // Arrange — SMS-koden er aldri verifisert → blokkerer steg 4
        _verificationInfoService
            .Setup(v => v.IsSmsPasswordResetVerifiedAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure("SMS verification required", AppErrorCode.ResetSessionNotVerified));

        var sut = BuildSut();

        // Act
        var result = await sut.ResetPasswordAsync(Email, "NyttPassord123!", Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.ResetSessionNotVerified);
        _userManager.Verify(m => m.RemovePasswordAsync(It.IsAny<AppUser>()), Times.Never);
    }

    [Fact]
    public async Task ResetPasswordAsync_WhenRemovePasswordFails_ShouldReturnInternalError()
    {
        // Arrange
        _userManager
            .Setup(m => m.RemovePasswordAsync(It.IsAny<AppUser>()))
            .ReturnsAsync(IdentityResult.Failed(new IdentityError { Description = "DB feil" }));

        var sut = BuildSut();

        // Act
        var result = await sut.ResetPasswordAsync(Email, "NyttPassord123!", Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.InternalError);
        _userManager.Verify(m => m.AddPasswordAsync(It.IsAny<AppUser>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task ResetPasswordAsync_WhenAddPasswordFails_ShouldReturnInvalidRegistrationData()
    {
        // Arrange — passord oppfyller ikke Identity-reglene
        _userManager
            .Setup(m => m.AddPasswordAsync(It.IsAny<AppUser>(), It.IsAny<string>()))
            .ReturnsAsync(IdentityResult.Failed(
                new IdentityError { Description = "Passwords must have at least one digit." }));

        var sut = BuildSut();

        // Act
        var result = await sut.ResetPasswordAsync(Email, "svaktpassord", Ip);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.InvalidRegistrationData);
    }

    [Fact]
    public async Task ResetPasswordAsync_WhenSuccessful_ShouldClearRateLimitsAndReturnSuccess()
    {
        // Arrange
        var sut = BuildSut();

        // Act
        var result = await sut.ResetPasswordAsync(Email, "NyttPassord123!", Ip);

        // Assert
        result.IsSuccess.Should().BeTrue();

        _emailRateLimitService.Verify(
            r => r.ClearEmailAttempts(EmailType.PasswordReset, Email),
            Times.Once);

        _smsRateLimitService.Verify(
            r => r.ClearSmsAttempts(SmsType.PasswordReset, Phone),
            Times.Once);
    }

    [Fact]
    public async Task ResetPasswordAsync_WhenUserIsLockedOut_ShouldLiftLockoutAfterSuccessfulReset()
    {
        // Arrange — brukeren er utestengt (f.eks. etter "This wasn't me"-rapportering)
        _userManager
            .Setup(m => m.IsLockedOutAsync(It.IsAny<AppUser>()))
            .ReturnsAsync(true);

        var sut = BuildSut();

        // Act
        var result = await sut.ResetPasswordAsync(Email, "NyttPassord123!", Ip);

        // Assert
        result.IsSuccess.Should().BeTrue();

        _userManager.Verify(
            m => m.SetLockoutEndDateAsync(It.IsAny<AppUser>(), null),
            Times.Once);

        _userManager.Verify(
            m => m.ResetAccessFailedCountAsync(It.IsAny<AppUser>()),
            Times.Once);
    }
}
