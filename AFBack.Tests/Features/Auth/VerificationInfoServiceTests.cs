using AFBack.Common.Enum;
using AFBack.Configurations.Options;
using AFBack.Features.Auth.Models;
using AFBack.Features.Auth.Repositories;
using AFBack.Features.Auth.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;

namespace AFBack.Tests.Features.Auth;

public class VerificationInfoServiceTests
{
    private readonly Mock<IVerificationInfoRepository> _repository;
    private readonly VerificationInfoService _sut;

    private const string UserId = "user-guid-123";

    public VerificationInfoServiceTests()
    {
        _repository = new Mock<IVerificationInfoRepository>();
        _sut = new VerificationInfoService(_repository.Object, Mock.Of<ILogger<VerificationInfoService>>());
    }

    // ======================== GenerateEmailVerificationAsync ========================

    [Fact]
    public async Task GenerateEmailVerificationAsync_WhenVerificationInfoExists_ShouldSetCodeExpiryAndPersist()
    {
        // Arrange
        var verificationInfo = new VerificationInfo { UserId = UserId };
        _repository
            .Setup(r => r.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(verificationInfo);

        var before = DateTime.UtcNow;

        // Act
        var code = await _sut.GenerateEmailVerificationAsync(UserId);

        // Assert — returnert kode er et 6-sifret tall
        code.Should().MatchRegex(@"^\d{6}$");

        // Koden er lagret i VerificationInfo
        verificationInfo.EmailConfirmationCode.Should().Be(code);

        // Expiry er satt til fremtiden
        verificationInfo.EmailCodeExpiresAt.Should().BeAfter(before);

        // Tidspunkt for siste sending er satt
        verificationInfo.LastVerificationEmailSentAt.Should().BeOnOrAfter(before);

        // SaveChanges er kalt én gang
        _repository.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GenerateEmailVerificationAsync_WhenFailedAttemptsExist_ShouldResetCounterToZero()
    {
        // Arrange — simulerer en bruker som har bommet på koden tre ganger tidligere
        var verificationInfo = new VerificationInfo
        {
            UserId = UserId,
            EmailCodeFailedAttempts = 3,
        };
        _repository
            .Setup(r => r.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(verificationInfo);

        // Act
        await _sut.GenerateEmailVerificationAsync(UserId);

        // Assert — telleren nullstilles ved ny kode slik at brukeren ikke er utestengt
        verificationInfo.EmailCodeFailedAttempts.Should().Be(0);
    }

    [Fact]
    public async Task GenerateEmailVerificationAsync_WhenVerificationInfoMissing_ShouldThrowInvalidOperationException()
    {
        // Arrange — VerificationInfo mangler (opprettelsessvikt i signup-flyten)
        _repository
            .Setup(r => r.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((VerificationInfo?)null);

        // Act
        var act = async () => await _sut.GenerateEmailVerificationAsync(UserId);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*VerificationInfo missing*");
    }

    // ======================== GenerateLoginMfaCodeAsync ========================

    [Fact]
    public async Task GenerateLoginMfaCodeAsync_WhenVerificationInfoExists_ShouldSetCodeExpiryAndPersist()
    {
        // Arrange
        var verificationInfo = new VerificationInfo { UserId = UserId };
        _repository
            .Setup(r => r.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(verificationInfo);

        var before = DateTime.UtcNow;

        // Act
        var code = await _sut.GenerateLoginMfaCodeAsync(UserId);

        // Assert — returnert kode er et 6-sifret tall
        code.Should().MatchRegex(@"^\d{6}$");

        // Koden er lagret i VerificationInfo
        verificationInfo.LoginMfaCode.Should().Be(code);

        // Expiry er satt til fremtiden
        verificationInfo.LoginMfaCodeExpiresAt.Should().BeAfter(before);

        // Tidspunkt for siste sending er satt
        verificationInfo.LastLoginMfaCodeSentAt.Should().BeOnOrAfter(before);

        // SaveChanges er kalt én gang
        _repository.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GenerateLoginMfaCodeAsync_WhenFailedAttemptsExist_ShouldResetCounterToZero()
    {
        // Arrange — bruker har bommet på MFA-koden tidligere
        var verificationInfo = new VerificationInfo
        {
            UserId = UserId,
            LoginMfaCodeFailedAttempts = 4,
        };
        _repository
            .Setup(r => r.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(verificationInfo);

        // Act
        await _sut.GenerateLoginMfaCodeAsync(UserId);

        // Assert — telleren nullstilles ved ny kode slik at brukeren ikke er utestengt
        verificationInfo.LoginMfaCodeFailedAttempts.Should().Be(0);
    }

    [Fact]
    public async Task GenerateLoginMfaCodeAsync_WhenVerificationInfoMissing_ShouldThrowInvalidOperationException()
    {
        // Arrange — VerificationInfo mangler
        _repository
            .Setup(r => r.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((VerificationInfo?)null);

        // Act
        var act = async () => await _sut.GenerateLoginMfaCodeAsync(UserId);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*VerificationInfo missing*");
    }

    // ======================== ValidateEmailCodeAsync ========================

    [Fact]
    public async Task ValidateEmailCodeAsync_WhenTooManyFailedAttempts_ShouldReturnTooManyRequests()
    {
        // Arrange
        var verificationInfo = new VerificationInfo
        {
            UserId                    = UserId,
            EmailConfirmationCode     = "123456",
            EmailCodeExpiresAt        = DateTime.UtcNow.AddMinutes(10),
            EmailCodeFailedAttempts   = VerificationConfig.MaxFailedAttempts,
        };
        _repository
            .Setup(r => r.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(verificationInfo);

        // Act
        var result = await _sut.ValidateEmailCodeAsync(UserId, "123456");

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.TooManyRequests);
    }

    [Fact]
    public async Task ValidateEmailCodeAsync_WhenCodeIsExpired_ShouldReturnExpiredCode()
    {
        // Arrange
        var verificationInfo = new VerificationInfo
        {
            UserId             = UserId,
            EmailConfirmationCode = "123456",
            EmailCodeExpiresAt = DateTime.UtcNow.AddMinutes(-1),
        };
        _repository
            .Setup(r => r.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(verificationInfo);

        // Act
        var result = await _sut.ValidateEmailCodeAsync(UserId, "123456");

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.ExpiredCode);
    }

    [Fact]
    public async Task ValidateEmailCodeAsync_WhenCodeIsWrong_ShouldIncrementFailedAttemptsAndReturnInvalidCode()
    {
        // Arrange
        var verificationInfo = new VerificationInfo
        {
            UserId                  = UserId,
            EmailConfirmationCode   = "123456",
            EmailCodeExpiresAt      = DateTime.UtcNow.AddMinutes(10),
            EmailCodeFailedAttempts = 0,
        };
        _repository
            .Setup(r => r.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(verificationInfo);

        // Act
        var result = await _sut.ValidateEmailCodeAsync(UserId, "999999");

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.InvalidCode);
        verificationInfo.EmailCodeFailedAttempts.Should().Be(1);
        _repository.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ValidateEmailCodeAsync_WhenCodeIsCorrect_ShouldClearCodeAndReturnSuccess()
    {
        // Arrange
        const string code = "123456";
        var verificationInfo = new VerificationInfo
        {
            UserId                  = UserId,
            EmailConfirmationCode   = code,
            EmailCodeExpiresAt      = DateTime.UtcNow.AddMinutes(10),
            EmailCodeFailedAttempts = 1,
        };
        _repository
            .Setup(r => r.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(verificationInfo);

        // Act
        var result = await _sut.ValidateEmailCodeAsync(UserId, code);

        // Assert
        result.IsSuccess.Should().BeTrue();
        verificationInfo.EmailConfirmationCode.Should().BeNull();
        verificationInfo.EmailCodeExpiresAt.Should().BeNull();
        verificationInfo.EmailCodeFailedAttempts.Should().Be(0);
        _repository.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    // ======================== ValidatePhoneCodeAsync ========================

    [Fact]
    public async Task ValidatePhoneCodeAsync_WhenTooManyFailedAttempts_ShouldReturnTooManyRequests()
    {
        // Arrange
        var verificationInfo = new VerificationInfo
        {
            UserId                     = UserId,
            PhoneVerificationCode      = "123456",
            PhoneCodeExpiresAt         = DateTime.UtcNow.AddMinutes(10),
            PhoneCodeFailedAttempts    = VerificationConfig.MaxFailedAttempts,
        };
        _repository
            .Setup(r => r.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(verificationInfo);

        // Act
        var result = await _sut.ValidatePhoneCodeAsync(UserId, "123456");

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.TooManyRequests);
    }

    [Fact]
    public async Task ValidatePhoneCodeAsync_WhenCodeIsExpired_ShouldReturnExpiredCode()
    {
        // Arrange
        var verificationInfo = new VerificationInfo
        {
            UserId                = UserId,
            PhoneVerificationCode = "123456",
            PhoneCodeExpiresAt    = DateTime.UtcNow.AddMinutes(-1),
        };
        _repository
            .Setup(r => r.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(verificationInfo);

        // Act
        var result = await _sut.ValidatePhoneCodeAsync(UserId, "123456");

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.ExpiredCode);
    }

    [Fact]
    public async Task ValidatePhoneCodeAsync_WhenCodeIsWrong_ShouldIncrementFailedAttemptsAndReturnInvalidCode()
    {
        // Arrange
        var verificationInfo = new VerificationInfo
        {
            UserId                  = UserId,
            PhoneVerificationCode   = "123456",
            PhoneCodeExpiresAt      = DateTime.UtcNow.AddMinutes(10),
            PhoneCodeFailedAttempts = 0,
        };
        _repository
            .Setup(r => r.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(verificationInfo);

        // Act
        var result = await _sut.ValidatePhoneCodeAsync(UserId, "999999");

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.InvalidCode);
        verificationInfo.PhoneCodeFailedAttempts.Should().Be(1);
        _repository.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ValidatePhoneCodeAsync_WhenCodeIsCorrect_ShouldClearCodeAndReturnSuccess()
    {
        // Arrange
        const string code = "123456";
        var verificationInfo = new VerificationInfo
        {
            UserId                  = UserId,
            PhoneVerificationCode   = code,
            PhoneCodeExpiresAt      = DateTime.UtcNow.AddMinutes(10),
            PhoneCodeFailedAttempts = 2,
        };
        _repository
            .Setup(r => r.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(verificationInfo);

        // Act
        var result = await _sut.ValidatePhoneCodeAsync(UserId, code);

        // Assert
        result.IsSuccess.Should().BeTrue();
        verificationInfo.PhoneVerificationCode.Should().BeNull();
        verificationInfo.PhoneCodeExpiresAt.Should().BeNull();
        verificationInfo.PhoneCodeFailedAttempts.Should().Be(0);
        _repository.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    // ======================== ValidateLoginMfaCodeAsync ========================

    [Fact]
    public async Task ValidateLoginMfaCodeAsync_WhenTooManyFailedAttempts_ShouldReturnTooManyRequests()
    {
        // Arrange — MaxFailedAttempts = 5; bruker er allerede låst ute
        var verificationInfo = new VerificationInfo
        {
            UserId                    = UserId,
            LoginMfaCode              = "123456",
            LoginMfaCodeExpiresAt     = DateTime.UtcNow.AddMinutes(10),
            LoginMfaCodeFailedAttempts = VerificationConfig.MaxFailedAttempts,
        };
        _repository
            .Setup(r => r.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(verificationInfo);

        // Act
        var result = await _sut.ValidateLoginMfaCodeAsync(UserId, "123456");

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.TooManyRequests);
    }

    [Fact]
    public async Task ValidateLoginMfaCodeAsync_WhenCodeIsExpired_ShouldReturnExpiredCode()
    {
        // Arrange — koden er utløpt
        var verificationInfo = new VerificationInfo
        {
            UserId                = UserId,
            LoginMfaCode          = "123456",
            LoginMfaCodeExpiresAt = DateTime.UtcNow.AddMinutes(-1),
        };
        _repository
            .Setup(r => r.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(verificationInfo);

        // Act
        var result = await _sut.ValidateLoginMfaCodeAsync(UserId, "123456");

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.ExpiredCode);
    }

    [Fact]
    public async Task ValidateLoginMfaCodeAsync_WhenNoCodeExists_ShouldReturnExpiredCode()
    {
        // Arrange — ingen kode er generert ennå (LoginMfaCode er null)
        var verificationInfo = new VerificationInfo { UserId = UserId };
        _repository
            .Setup(r => r.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(verificationInfo);

        // Act
        var result = await _sut.ValidateLoginMfaCodeAsync(UserId, "123456");

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.ExpiredCode);
    }

    [Fact]
    public async Task ValidateLoginMfaCodeAsync_WhenCodeIsWrong_ShouldIncrementFailedAttemptsAndReturnInvalidCode()
    {
        // Arrange
        var verificationInfo = new VerificationInfo
        {
            UserId                     = UserId,
            LoginMfaCode               = "123456",
            LoginMfaCodeExpiresAt      = DateTime.UtcNow.AddMinutes(10),
            LoginMfaCodeFailedAttempts = 0,
        };
        _repository
            .Setup(r => r.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(verificationInfo);

        // Act
        var result = await _sut.ValidateLoginMfaCodeAsync(UserId, "999999");

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.InvalidCode);

        verificationInfo.LoginMfaCodeFailedAttempts.Should().Be(1);
        _repository.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ValidateLoginMfaCodeAsync_WhenCodeIsCorrect_ShouldClearCodeAndReturnSuccess()
    {
        // Arrange
        const string code = "123456";
        var verificationInfo = new VerificationInfo
        {
            UserId                     = UserId,
            LoginMfaCode               = code,
            LoginMfaCodeExpiresAt      = DateTime.UtcNow.AddMinutes(10),
            LoginMfaCodeFailedAttempts = 2,
        };
        _repository
            .Setup(r => r.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(verificationInfo);

        // Act
        var result = await _sut.ValidateLoginMfaCodeAsync(UserId, code);

        // Assert
        result.IsSuccess.Should().BeTrue();

        // Koden nullstilles etter vellykket validering
        verificationInfo.LoginMfaCode.Should().BeNull();
        verificationInfo.LoginMfaCodeExpiresAt.Should().BeNull();
        verificationInfo.LoginMfaCodeFailedAttempts.Should().Be(0);

        _repository.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    // ======================== GenerateEmailPasswordResetAsync ========================

    [Fact]
    public async Task GenerateEmailPasswordResetAsync_WhenVerificationInfoExists_ShouldSetCodeExpiryAndResetSmsFields()
    {
        // Arrange — simulerer at en gammel SMS-kode finnes fra et tidligere reset-forsøk
        var verificationInfo = new VerificationInfo
        {
            UserId                              = UserId,
            SmsPasswordResetCode                = "999999",
            SmsPasswordResetCodeExpiresAt       = DateTime.UtcNow.AddMinutes(5),
            SmsPasswordResetCodeFailedAttempts  = 2,
            EmailPasswordResetVerified          = true,
            SmsPasswordResetVerified            = true,
        };
        _repository
            .Setup(r => r.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(verificationInfo);

        var before = DateTime.UtcNow;

        // Act
        var code = await _sut.GenerateEmailPasswordResetAsync(UserId);

        // Assert — ny kode er 6-sifret
        code.Should().MatchRegex(@"^\d{6}$");
        verificationInfo.EmailPasswordResetCode.Should().Be(code);
        verificationInfo.EmailPasswordResetCodeExpiresAt.Should().BeAfter(before);
        verificationInfo.LastEmailPasswordResetSentAt.Should().BeOnOrAfter(before);

        // Verifikasjons-flagg nullstilles
        verificationInfo.EmailPasswordResetVerified.Should().BeFalse();
        verificationInfo.SmsPasswordResetVerified.Should().BeFalse();

        // Gammel SMS-kode nullstilles
        verificationInfo.SmsPasswordResetCode.Should().BeNull();
        verificationInfo.SmsPasswordResetCodeExpiresAt.Should().BeNull();
        verificationInfo.SmsPasswordResetCodeFailedAttempts.Should().Be(0);

        _repository.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GenerateEmailPasswordResetAsync_WhenVerificationInfoMissing_ShouldThrowInvalidOperationException()
    {
        // Arrange
        _repository
            .Setup(r => r.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((VerificationInfo?)null);

        // Act
        var act = async () => await _sut.GenerateEmailPasswordResetAsync(UserId);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*VerificationInfo missing*");
    }

    // ======================== ValidateEmailPasswordResetCodeAsync ========================

    [Fact]
    public async Task ValidateEmailPasswordResetCodeAsync_WhenTooManyFailedAttempts_ShouldReturnTooManyRequests()
    {
        // Arrange
        var verificationInfo = new VerificationInfo
        {
            UserId                                  = UserId,
            EmailPasswordResetCode                  = "123456",
            EmailPasswordResetCodeExpiresAt         = DateTime.UtcNow.AddMinutes(10),
            EmailPasswordResetCodeFailedAttempts    = VerificationConfig.MaxFailedAttempts,
        };
        _repository
            .Setup(r => r.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(verificationInfo);

        // Act
        var result = await _sut.ValidateEmailPasswordResetCodeAsync(UserId, "123456");

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.TooManyRequests);
    }

    [Fact]
    public async Task ValidateEmailPasswordResetCodeAsync_WhenCodeIsExpired_ShouldReturnExpiredCode()
    {
        // Arrange
        var verificationInfo = new VerificationInfo
        {
            UserId                          = UserId,
            EmailPasswordResetCode          = "123456",
            EmailPasswordResetCodeExpiresAt = DateTime.UtcNow.AddMinutes(-1),
        };
        _repository
            .Setup(r => r.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(verificationInfo);

        // Act
        var result = await _sut.ValidateEmailPasswordResetCodeAsync(UserId, "123456");

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.ExpiredCode);
    }

    [Fact]
    public async Task ValidateEmailPasswordResetCodeAsync_WhenCodeIsWrong_ShouldIncrementFailedAttemptsAndReturnInvalidCode()
    {
        // Arrange
        var verificationInfo = new VerificationInfo
        {
            UserId                                  = UserId,
            EmailPasswordResetCode                  = "123456",
            EmailPasswordResetCodeExpiresAt         = DateTime.UtcNow.AddMinutes(10),
            EmailPasswordResetCodeFailedAttempts    = 0,
        };
        _repository
            .Setup(r => r.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(verificationInfo);

        // Act
        var result = await _sut.ValidateEmailPasswordResetCodeAsync(UserId, "999999");

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.InvalidCode);
        verificationInfo.EmailPasswordResetCodeFailedAttempts.Should().Be(1);
        _repository.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ValidateEmailPasswordResetCodeAsync_WhenCodeIsCorrect_ShouldClearCodeAndSetEmailVerifiedTrue()
    {
        // Arrange
        const string code = "123456";
        var verificationInfo = new VerificationInfo
        {
            UserId                                  = UserId,
            EmailPasswordResetCode                  = code,
            EmailPasswordResetCodeExpiresAt         = DateTime.UtcNow.AddMinutes(10),
            EmailPasswordResetCodeFailedAttempts    = 1,
            EmailPasswordResetVerified              = false,
        };
        _repository
            .Setup(r => r.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(verificationInfo);

        // Act
        var result = await _sut.ValidateEmailPasswordResetCodeAsync(UserId, code);

        // Assert
        result.IsSuccess.Should().BeTrue();
        verificationInfo.EmailPasswordResetCode.Should().BeNull();
        verificationInfo.EmailPasswordResetCodeExpiresAt.Should().BeNull();
        verificationInfo.EmailPasswordResetCodeFailedAttempts.Should().Be(0);
        verificationInfo.EmailPasswordResetVerified.Should().BeTrue();
        _repository.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    // ======================== GenerateSmsPasswordResetCodeAsync ========================

    [Fact]
    public async Task GenerateSmsPasswordResetCodeAsync_WhenEmailNotVerified_ShouldThrowInvalidOperationException()
    {
        // Arrange — bruker har ikke fullført epost-steg
        var verificationInfo = new VerificationInfo
        {
            UserId                     = UserId,
            EmailPasswordResetVerified = false,
        };
        _repository
            .Setup(r => r.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(verificationInfo);

        // Act
        var act = async () => await _sut.GenerateSmsPasswordResetCodeAsync(UserId);

        // Assert — guard kaster exception; forhindrer hopping over epost-steget
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*Email must be verified*");
    }

    [Fact]
    public async Task GenerateSmsPasswordResetCodeAsync_WhenEmailVerified_ShouldSetCodeExpiryAndPersist()
    {
        // Arrange — epost-steget er fullført
        var verificationInfo = new VerificationInfo
        {
            UserId                     = UserId,
            EmailPasswordResetVerified = true,
        };
        _repository
            .Setup(r => r.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(verificationInfo);

        var before = DateTime.UtcNow;

        // Act
        var code = await _sut.GenerateSmsPasswordResetCodeAsync(UserId);

        // Assert
        code.Should().MatchRegex(@"^\d{6}$");
        verificationInfo.SmsPasswordResetCode.Should().Be(code);
        verificationInfo.SmsPasswordResetCodeExpiresAt.Should().BeAfter(before);
        verificationInfo.SmsPasswordResetCodeFailedAttempts.Should().Be(0);
        verificationInfo.LastSmsPasswordResetSentAt.Should().BeOnOrAfter(before);
        _repository.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    // ======================== ValidateSmsPasswordResetCodeAsync ========================

    [Fact]
    public async Task ValidateSmsPasswordResetCodeAsync_WhenEmailNotVerified_ShouldReturnUnauthorized()
    {
        // Arrange — epost-steget ikke fullført; guard i ValidateSmsPasswordResetCodeAsync slår inn
        var verificationInfo = new VerificationInfo
        {
            UserId                     = UserId,
            EmailPasswordResetVerified = false,
            SmsPasswordResetCode       = "123456",
            SmsPasswordResetCodeExpiresAt = DateTime.UtcNow.AddMinutes(10),
        };
        _repository
            .Setup(r => r.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(verificationInfo);

        // Act
        var result = await _sut.ValidateSmsPasswordResetCodeAsync(UserId, "123456");

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.Unauthorized);
    }

    [Fact]
    public async Task ValidateSmsPasswordResetCodeAsync_WhenTooManyFailedAttempts_ShouldReturnTooManyRequests()
    {
        // Arrange
        var verificationInfo = new VerificationInfo
        {
            UserId                                = UserId,
            EmailPasswordResetVerified            = true,
            SmsPasswordResetCode                  = "123456",
            SmsPasswordResetCodeExpiresAt         = DateTime.UtcNow.AddMinutes(10),
            SmsPasswordResetCodeFailedAttempts    = VerificationConfig.MaxFailedAttempts,
        };
        _repository
            .Setup(r => r.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(verificationInfo);

        // Act
        var result = await _sut.ValidateSmsPasswordResetCodeAsync(UserId, "123456");

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.TooManyRequests);
    }

    [Fact]
    public async Task ValidateSmsPasswordResetCodeAsync_WhenCodeIsExpired_ShouldReturnExpiredCode()
    {
        // Arrange
        var verificationInfo = new VerificationInfo
        {
            UserId                        = UserId,
            EmailPasswordResetVerified    = true,
            SmsPasswordResetCode          = "123456",
            SmsPasswordResetCodeExpiresAt = DateTime.UtcNow.AddMinutes(-1),
        };
        _repository
            .Setup(r => r.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(verificationInfo);

        // Act
        var result = await _sut.ValidateSmsPasswordResetCodeAsync(UserId, "123456");

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.ExpiredCode);
    }

    [Fact]
    public async Task ValidateSmsPasswordResetCodeAsync_WhenCodeIsWrong_ShouldIncrementFailedAttemptsAndReturnInvalidCode()
    {
        // Arrange
        var verificationInfo = new VerificationInfo
        {
            UserId                                = UserId,
            EmailPasswordResetVerified            = true,
            SmsPasswordResetCode                  = "123456",
            SmsPasswordResetCodeExpiresAt         = DateTime.UtcNow.AddMinutes(10),
            SmsPasswordResetCodeFailedAttempts    = 0,
        };
        _repository
            .Setup(r => r.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(verificationInfo);

        // Act
        var result = await _sut.ValidateSmsPasswordResetCodeAsync(UserId, "999999");

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.InvalidCode);
        verificationInfo.SmsPasswordResetCodeFailedAttempts.Should().Be(1);
        _repository.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ValidateSmsPasswordResetCodeAsync_WhenCodeIsCorrect_ShouldClearCodeAndSetSmsVerifiedTrue()
    {
        // Arrange
        const string code = "123456";
        var verificationInfo = new VerificationInfo
        {
            UserId                                = UserId,
            EmailPasswordResetVerified            = true,
            SmsPasswordResetCode                  = code,
            SmsPasswordResetCodeExpiresAt         = DateTime.UtcNow.AddMinutes(10),
            SmsPasswordResetCodeFailedAttempts    = 1,
            SmsPasswordResetVerified              = false,
        };
        _repository
            .Setup(r => r.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(verificationInfo);

        var before = DateTime.UtcNow;

        // Act
        var result = await _sut.ValidateSmsPasswordResetCodeAsync(UserId, code);

        // Assert
        result.IsSuccess.Should().BeTrue();
        verificationInfo.SmsPasswordResetCode.Should().BeNull();
        verificationInfo.SmsPasswordResetCodeExpiresAt.Should().BeNull();
        verificationInfo.SmsPasswordResetCodeFailedAttempts.Should().Be(0);
        verificationInfo.SmsPasswordResetVerified.Should().BeTrue();
        verificationInfo.SmsPasswordResetVerifiedAt.Should().BeOnOrAfter(before);
        _repository.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    // ======================== IsSmsPasswordResetVerifiedAsync ========================

    [Fact]
    public async Task IsSmsPasswordResetVerifiedAsync_WhenSmsNotVerified_ShouldReturnResetSessionNotVerified()
    {
        // Arrange — SMS-koden er aldri verifisert
        var verificationInfo = new VerificationInfo
        {
            UserId                   = UserId,
            SmsPasswordResetVerified = false,
        };
        _repository
            .Setup(r => r.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(verificationInfo);

        // Act
        var result = await _sut.IsSmsPasswordResetVerifiedAsync(UserId);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.ResetSessionNotVerified);
    }

    [Fact]
    public async Task IsSmsPasswordResetVerifiedAsync_WhenWindowExpired_ShouldReturnResetSessionExpired()
    {
        // Arrange — SMS ble verifisert, men tidsvinduet er utløpt
        var verificationInfo = new VerificationInfo
        {
            UserId                       = UserId,
            SmsPasswordResetVerified     = true,
            SmsPasswordResetVerifiedAt   = DateTime.UtcNow
                .AddMinutes(-VerificationConfig.PasswordResetWindowMinutes - 1),
        };
        _repository
            .Setup(r => r.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(verificationInfo);

        // Act
        var result = await _sut.IsSmsPasswordResetVerifiedAsync(UserId);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.ResetSessionExpired);
    }

    [Fact]
    public async Task IsSmsPasswordResetVerifiedAsync_WhenVerifiedWithinWindow_ShouldReturnSuccess()
    {
        // Arrange — SMS verifisert nylig, innenfor vinduet
        var verificationInfo = new VerificationInfo
        {
            UserId                     = UserId,
            SmsPasswordResetVerified   = true,
            SmsPasswordResetVerifiedAt = DateTime.UtcNow.AddMinutes(-1),
        };
        _repository
            .Setup(r => r.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(verificationInfo);

        // Act
        var result = await _sut.IsSmsPasswordResetVerifiedAsync(UserId);

        // Assert
        result.IsSuccess.Should().BeTrue();
    }
}
