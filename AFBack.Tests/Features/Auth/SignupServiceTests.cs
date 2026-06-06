using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Configurations.Options;
using AFBack.Features.Auth.DTOs.Request;
using AFBack.Features.Auth.DTOs.Response;
using AFBack.Features.Auth.Models;
using AFBack.Features.Auth.Repositories;
using AFBack.Features.Auth.Services;
using AFBack.Features.Auth.Services.Interfaces;
using AFBack.Infrastructure.Email;
using AFBack.Infrastructure.Email.Enums;
using AFBack.Infrastructure.Email.Models;
using AFBack.Infrastructure.Security.Services;
using AFBack.Infrastructure.Transactions;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;

namespace AFBack.Tests.Features.Auth;

public class SignupServiceTests
{
    private readonly Mock<UserManager<AppUser>> _userManager;
    private readonly Mock<ILogger<AuthService>> _logger;
    private readonly Mock<IUserRepository> _userRepository;
    private readonly Mock<IEmailService> _emailService;
    private readonly Mock<IVerificationInfoService> _verificationInfoService;
    private readonly Mock<IEmailRateLimitService> _emailRateLimitService;
    private readonly Mock<ISuspiciousActivityService> _suspiciousActivityService;
    private readonly Mock<IRateLimitGuardService> _rateLimitGuardService;
    private readonly Mock<ITransactionService> _transactionService;

    private readonly SignupRequest _validRequest = new()
    {
        Email        = "ny@test.no",
        Password     = "TestPass123!",
        FirstName    = "Test",
        LastName     = "Bruker",
        PhoneNumber  = "+4712345678",
        DateOfBirth  = new DateOnly(1995, 6, 15),
        CountryCode  = "NO",
    };

    public SignupServiceTests()
    {
        var store = new Mock<IUserStore<AppUser>>();
        _userManager = new Mock<UserManager<AppUser>>(
            store.Object, null!, null!, null!, null!, null!, null!, null!, null!);

        _logger                    = new Mock<ILogger<AuthService>>();
        _userRepository            = new Mock<IUserRepository>();
        _emailService              = new Mock<IEmailService>();
        _verificationInfoService   = new Mock<IVerificationInfoService>();
        _emailRateLimitService     = new Mock<IEmailRateLimitService>();
        _suspiciousActivityService = new Mock<ISuspiciousActivityService>();
        _rateLimitGuardService     = new Mock<IRateLimitGuardService>();
        _transactionService        = new Mock<ITransactionService>();

        // Standard happy-path-oppsett — overstyres i tester som tester feilscenarioer
        _rateLimitGuardService
            .Setup(r => r.CheckEmailRateLimitAsync(
                It.IsAny<EmailType>(), It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(Result.Success());

        _userManager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync((AppUser?)null);

        _userRepository
            .Setup(r => r.FindByPhoneAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((AppUser?)null);

        _transactionService
            .Setup(t => t.ExecuteAsync(
                It.IsAny<Func<CancellationToken, Task<Result<SignupResponse>>>>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<string>()))
            .Returns<Func<CancellationToken, Task<Result<SignupResponse>>>, CancellationToken, string>(
                (fn, ct, _) => fn(ct));

        _userManager
            .Setup(m => m.CreateAsync(It.IsAny<AppUser>(), It.IsAny<string>()))
            .ReturnsAsync(IdentityResult.Success);

        _userManager
            .Setup(m => m.AddToRoleAsync(It.IsAny<AppUser>(), It.IsAny<string>()))
            .ReturnsAsync(IdentityResult.Success);

        _verificationInfoService
            .Setup(v => v.GenerateEmailVerificationAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("123456");

        _emailService
            .Setup(e => e.SendAsync(It.IsAny<string>(), It.IsAny<EmailBody>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success());
    }

    private AuthService BuildSut() => new(
        _userManager.Object,
        _logger.Object,
        _userRepository.Object,
        _emailService.Object,
        Options.Create(new AppOptions { BaseUrl = "https://test.example.com" }),
        _verificationInfoService.Object,
        _emailRateLimitService.Object,
        Mock.Of<IUserDeviceService>(),
        Mock.Of<ILoginHistoryService>(),
        Mock.Of<IAccountVerificationService>(),
        _suspiciousActivityService.Object,
        Mock.Of<IVerificationInfoRepository>(),
        Mock.Of<ITokenService>(),
        _rateLimitGuardService.Object,
        _transactionService.Object);

    // ======================== RateLimit ========================

    [Fact]
    public async Task SignupAsync_WhenRateLimitExceeded_ShouldReturnFailure()
    {
        // Arrange
        _rateLimitGuardService
            .Setup(r => r.CheckEmailRateLimitAsync(
                It.IsAny<EmailType>(), It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(Result.Failure("Rate limit exceeded", AppErrorCode.TooManyRequests));

        var sut = BuildSut();

        // Act
        var result = await sut.SignupAsync(_validRequest, "127.0.0.1");

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.TooManyRequests);
    }

    // ======================== Konflikt ========================

    [Fact]
    public async Task SignupAsync_WhenEmailAlreadyExists_ShouldReturnEmailAlreadyExistsFailure()
    {
        // Arrange
        _userManager
            .Setup(m => m.FindByEmailAsync(_validRequest.Email))
            .ReturnsAsync(new AppUser { Email = _validRequest.Email });

        var sut = BuildSut();

        // Act
        var result = await sut.SignupAsync(_validRequest, "127.0.0.1");

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.EmailAlreadyExists);
    }

    [Fact]
    public async Task SignupAsync_WhenPhoneAlreadyExists_ShouldReturnPhoneNumberAlreadyExistsFailure()
    {
        // Arrange
        _userRepository
            .Setup(r => r.FindByPhoneAsync(_validRequest.PhoneNumber, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AppUser { PhoneNumber = _validRequest.PhoneNumber });

        var sut = BuildSut();

        // Act
        var result = await sut.SignupAsync(_validRequest, "127.0.0.1");

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.PhoneNumberAlreadyExists);
    }

    // ======================== Opprettelse ========================

    [Fact]
    public async Task SignupAsync_WhenUserCreationFails_ShouldReturnInvalidRegistrationDataFailure()
    {
        // Arrange
        var identityErrors = new[] { new IdentityError { Description = "Passwords must have at least one digit." } };
        _userManager
            .Setup(m => m.CreateAsync(It.IsAny<AppUser>(), It.IsAny<string>()))
            .ReturnsAsync(IdentityResult.Failed(identityErrors));

        var sut = BuildSut();

        // Act
        var result = await sut.SignupAsync(_validRequest, "127.0.0.1");

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.InvalidRegistrationData);
    }

    [Fact]
    public async Task SignupAsync_WhenRoleAssignmentFails_ShouldReturnInternalErrorFailure()
    {
        // Arrange
        var identityErrors = new[] { new IdentityError { Description = "Role does not exist." } };
        _userManager
            .Setup(m => m.AddToRoleAsync(It.IsAny<AppUser>(), It.IsAny<string>()))
            .ReturnsAsync(IdentityResult.Failed(identityErrors));

        var sut = BuildSut();

        // Act
        var result = await sut.SignupAsync(_validRequest, "127.0.0.1");

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.InternalError);
    }

    // ======================== Epost ========================

    [Fact]
    public async Task SignupAsync_WhenEmailSendFails_ShouldReturnInternalErrorFailure()
    {
        // Arrange
        _emailService
            .Setup(e => e.SendAsync(It.IsAny<string>(), It.IsAny<EmailBody>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure("SMTP feil", AppErrorCode.InternalError));

        var sut = BuildSut();

        // Act
        var result = await sut.SignupAsync(_validRequest, "127.0.0.1");

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.InternalError);
    }

    // ======================== Happy path ========================

    [Fact]
    public async Task SignupAsync_WithValidData_ShouldReturnUserIdAndEmailSent()
    {
        // Arrange
        var sut = BuildSut();

        // Act
        var result = await sut.SignupAsync(_validRequest, "127.0.0.1");

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.UserId.Should().NotBeNullOrEmpty();
        result.Value.EmailSent.Should().BeTrue();
    }
}
