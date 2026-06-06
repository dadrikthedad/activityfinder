using System.Collections.Concurrent;
using System.Reflection;
using AFBack.Common.Enum;
using AFBack.Configurations.Options;
using AFBack.Infrastructure.Email.Enums;
using AFBack.Infrastructure.Security.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;

namespace AFBack.Tests.Infrastructure.Security;

/// <summary>
/// Unit-tester for EmailRateLimitService.CanSendEmail.
/// Tjenesten bruker DateTime.UtcNow direkte (ingen injiserbar TimeProvider), så tester som
/// verifiserer at utdaterte oppføringer ignoreres bruker refleksjon for å sette timestamps i fortiden.
/// </summary>
public class EmailRateLimitServiceTests
{
    private const string Email      = "test@test.no";
    private const string Ip         = "10.0.0.1";
    private const EmailType Type    = EmailType.Verification;

    private readonly EmailRateLimitService _sut;

    public EmailRateLimitServiceTests()
    {
        _sut = new EmailRateLimitService(Mock.Of<ILogger<EmailRateLimitService>>());
    }

    // ======================== Kontraktbrudd ========================

    [Fact]
    public void CanSendEmail_WhenEmailIsNull_ShouldThrowArgumentException()
    {
        var act = () => _sut.CanSendEmail(Type, null!);
        act.Should().Throw<ArgumentException>().WithParameterName("emailAddress");
    }

    [Fact]
    public void CanSendEmail_WhenEmailIsEmpty_ShouldThrowArgumentException()
    {
        var act = () => _sut.CanSendEmail(Type, "");
        act.Should().Throw<ArgumentException>().WithParameterName("emailAddress");
    }

    // ======================== Happy path ========================

    [Fact]
    public void CanSendEmail_WithNoHistory_ShouldReturnSuccess()
    {
        var result = _sut.CanSendEmail(Type, Email, Ip);

        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public void CanSendEmail_WithoutIpAddress_ShouldSkipIpCheckAndReturnSuccess()
    {
        // Maks IP-grense nådd for Ip — men ingen IP sendes inn → sjekken hoppes over
        FillIpHistory(Ip, EmailRateConfig.MaxEmailsPerIpPerHour, age: TimeSpan.Zero);

        var result = _sut.CanSendEmail(Type, Email, ipAddress: null);

        result.IsSuccess.Should().BeTrue();
    }

    // ======================== IP-vindu ========================

    [Fact]
    public void CanSendEmail_WhenIpLimitReached_ShouldReturnTooManyRequests()
    {
        // Registrer maks antall forsøk fra samme IP med unike adresser (unngår daglig grense per adresse)
        for (var i = 0; i < EmailRateConfig.MaxEmailsPerIpPerHour; i++)
            _sut.RegisterEmailSent(Type, $"bruker{i}@test.no", Ip);

        var result = _sut.CanSendEmail(Type, Email, Ip);

        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.TooManyRequests);
    }

    [Fact]
    public void CanSendEmail_WhenIpHistoryIsOutsideWindow_ShouldReturnSuccess()
    {
        // Sett IP-historikk direkte med utdaterte timestamps (eldre enn IP-vinduet)
        var expiredAge = TimeSpan.FromMinutes(EmailRateConfig.EmailIpWindowMinutes + 1);
        FillIpHistory(Ip, EmailRateConfig.MaxEmailsPerIpPerHour, age: expiredAge);

        // CanSendEmail rydder opp utdaterte oppføringer — skal gå gjennom
        var result = _sut.CanSendEmail(Type, Email, Ip);

        result.IsSuccess.Should().BeTrue();
    }

    // ======================== Cooldown ========================

    [Fact]
    public void CanSendEmail_WhenWithinCooldown_ShouldReturnTooManyRequests()
    {
        _sut.RegisterEmailSent(Type, Email);

        // Cooldown = VerificationCooldownMinutes (2 min) — sjekker umiddelbart etter registrering
        var result = _sut.CanSendEmail(Type, Email);

        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.TooManyRequests);
    }

    [Fact]
    public void CanSendEmail_WhenCooldownHasExpired_ShouldReturnSuccess()
    {
        // Sett cooldown-timestamp direkte til etter cooldown-vinduet
        var expiredAge = TimeSpan.FromMinutes(EmailRateConfig.VerificationCooldownMinutes + 1);
        SetLastSentTimestamp(Type, Email, age: expiredAge);

        var result = _sut.CanSendEmail(Type, Email);

        result.IsSuccess.Should().BeTrue();
    }

    // ======================== Daglig grense ========================

    [Fact]
    public void CanSendEmail_WhenDailyLimitReached_ShouldReturnTooManyRequests()
    {
        for (var i = 0; i < EmailRateConfig.MaxVerificationEmailsPerDay; i++)
            _sut.RegisterEmailSent(Type, Email);

        // Fjern cooldown slik at daglig grense nås (ikke cooldown) som stopper requesten
        SetLastSentTimestamp(Type, Email, age: TimeSpan.FromHours(1));

        var result = _sut.CanSendEmail(Type, Email);

        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.TooManyRequests);
    }

    [Fact]
    public void CanSendEmail_WhenDailyHistoryIsOutsideWindow_ShouldReturnSuccess()
    {
        // Sett daglig historikk direkte med utdaterte timestamps (eldre enn 24-timersvinduet)
        var expiredAge = TimeSpan.FromHours(EmailRateConfig.EmailDayWindowHours + 1);
        FillDailyHistory(Type, Email, EmailRateConfig.MaxVerificationEmailsPerDay, age: expiredAge);

        var result = _sut.CanSendEmail(Type, Email);

        result.IsSuccess.Should().BeTrue();
    }

    // ======================== RegisterEmailSent ========================

    [Fact]
    public void RegisterEmailSent_WhenEmailIsNull_ShouldThrowArgumentException()
    {
        var act = () => _sut.RegisterEmailSent(Type, null!);
        act.Should().Throw<ArgumentException>().WithParameterName("emailAddress");
    }

    [Fact]
    public void RegisterEmailSent_WhenEmailIsEmpty_ShouldThrowArgumentException()
    {
        var act = () => _sut.RegisterEmailSent(Type, "");
        act.Should().Throw<ArgumentException>().WithParameterName("emailAddress");
    }

    [Fact]
    public void RegisterEmailSent_ShouldActivateCooldownSoNextCallIsBlocked()
    {
        // Act
        _sut.RegisterEmailSent(Type, Email);

        // Assert — neste CanSendEmail skal blokkeres av cooldown
        var result = _sut.CanSendEmail(Type, Email);
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.TooManyRequests);
    }

    [Fact]
    public void RegisterEmailSent_ShouldIncrementDailyCount_SoLimitIsEnforcedAfterMaxCalls()
    {
        // Arrange — registrer maks antall, og fjern cooldown mellom hver for ikke å stoppe der
        for (var i = 0; i < EmailRateConfig.MaxVerificationEmailsPerDay; i++)
        {
            _sut.RegisterEmailSent(Type, Email);
            SetLastSentTimestamp(Type, Email, age: TimeSpan.FromHours(1));
        }

        // Assert — neste CanSendEmail skal stoppes av daglig grense
        var result = _sut.CanSendEmail(Type, Email);
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.TooManyRequests);
    }

    [Fact]
    public void RegisterEmailSent_WithIp_ShouldIncrementIpCount_SoIpLimitIsEnforcedAfterMaxCalls()
    {
        // Arrange — registrer maks antall fra samme IP med unike adresser (unngår daglig grense per adresse)
        for (var i = 0; i < EmailRateConfig.MaxEmailsPerIpPerHour; i++)
            _sut.RegisterEmailSent(Type, $"unik{i}@test.no", Ip);

        // Assert — neste forsøk fra samme IP skal blokkeres
        var result = _sut.CanSendEmail(Type, Email, Ip);
        result.IsFailure.Should().BeTrue();
        result.ErrorCode.Should().Be(AppErrorCode.TooManyRequests);
    }

    [Fact]
    public void RegisterEmailSent_WithoutIp_ShouldNotIncrementIpCount()
    {
        // Arrange — fyll IP-telleren til ett under grensen via refleksjon
        FillIpHistory(Ip, EmailRateConfig.MaxEmailsPerIpPerHour - 1, age: TimeSpan.Zero);

        // Act — registrer e-post uten IP → skal ikke øke IP-teller
        _sut.RegisterEmailSent(Type, Email, ipAddress: null);

        // Assert — IP-teller er fortsatt under grensen, CanSendEmail passerer
        // (cooldown blokkerer nå pga RegisterEmailSent, men med en ny adresse skal IP ikke blokkere)
        var result = _sut.CanSendEmail(Type, $"annen-{Guid.NewGuid():N}@test.no", Ip);
        result.IsSuccess.Should().BeTrue();
    }

    // ======================== Refleksjonshjelpere ========================

    private void FillIpHistory(string ip, int count, TimeSpan age)
    {
        var dict = GetField<ConcurrentDictionary<string, Lazy<List<DateTime>>>>("_ipSendHistory");
        var list = dict.GetOrAdd(ip, _ => new Lazy<List<DateTime>>(() => [])).Value;
        lock (list)
        {
            for (var i = 0; i < count; i++)
                list.Add(DateTime.UtcNow - age);
        }
    }

    private void FillDailyHistory(EmailType emailType, string email, int count, TimeSpan age)
    {
        var key  = $"{emailType}:{email.ToLowerInvariant()}";
        var dict = GetField<ConcurrentDictionary<string, Lazy<List<DateTime>>>>("_dailySendHistory");
        var list = dict.GetOrAdd(key, _ => new Lazy<List<DateTime>>(() => [])).Value;
        lock (list)
        {
            for (var i = 0; i < count; i++)
                list.Add(DateTime.UtcNow - age);
        }
    }

    private void SetLastSentTimestamp(EmailType emailType, string email, TimeSpan age)
    {
        var key  = $"{emailType}:{email.ToLowerInvariant()}";
        var dict = GetField<ConcurrentDictionary<string, DateTime>>("_lastSentTimestamps");
        dict[key] = DateTime.UtcNow - age;
    }

    private T GetField<T>(string fieldName)
    {
        var field = typeof(EmailRateLimitService)
            .GetField(fieldName, BindingFlags.NonPublic | BindingFlags.Instance)
            ?? throw new InvalidOperationException($"Felt '{fieldName}' ikke funnet.");
        return (T)field.GetValue(_sut)!;
    }
}
