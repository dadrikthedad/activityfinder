using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Configurations.Options;
using AFBack.Features.Auth.DTOs.Request;
using AFBack.Infrastructure.Email;
using AFBack.Infrastructure.Email.Enums;
using AFBack.Infrastructure.Email.Models;
using AFBack.Infrastructure.Security.Services;
using AFBack.Tests.Builders;
using AFBack.Tests.Common;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Moq;

namespace AFBack.Tests.Features.Auth;

[Collection(nameof(IntegrationTestsCollection))]
public class ForgotPasswordIntegrationTests : IAsyncLifetime
{
    private readonly BackendApplicationFactory _factory;
    private readonly HttpClient _client;
    private readonly string _uniqueIp;

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    // ForgotPassword-tester bruker User-Agent-versjonsspenn 70100+ og IP-prefix 10.7.0.x.
    // Unik IP per instans isolerer in-memory e-post-rate-limiter mellom tester.
    private static int _testCounter;

    public ForgotPasswordIntegrationTests(BackendApplicationFactory factory)
    {
        _factory = factory;
        var id = Interlocked.Increment(ref _testCounter);
        _uniqueIp = $"10.7.0.{id}";
        _client = factory.CreateClientWithIp(_uniqueIp);
        _client.DefaultRequestHeaders.TryAddWithoutValidation(
            "User-Agent", $"Mozilla/5.0 Chrome/{id * 100 + 70000}.0 ForgotPasswordTest");
    }

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync()
    {
        await _factory.ResetDatabaseAsync();
        await _factory.ResetRedisAsync();
    }

    // ======================== 200 OK — bruker finnes ========================

    [Fact]
    public async Task ForgotPassword_WhenUserExists_ShouldReturn200AndSetResetCodeInDatabase()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        // Act
        var response = await _client.PostAsJsonAsync(
            Endpoints.PasswordReset.ForgotPassword,
            new EmailRequest { Email = user.Email! });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var codeSet = await _factory.QueryAsync(async db =>
        {
            var vi = await db.VerificationInfos.AsNoTracking()
                             .FirstAsync(v => v.UserId == user.Id);
            return vi.EmailPasswordResetCode != null;
        });
        codeSet.Should().BeTrue();
    }

    // ======================== 200 OK — bruker finnes ikke (anti-enumeration) ========================

    [Fact]
    public async Task ForgotPassword_WhenUserDoesNotExist_ShouldReturn200Silently()
    {
        // Arrange — ingen bruker seedes
        // Act
        var response = await _client.PostAsJsonAsync(
            Endpoints.PasswordReset.ForgotPassword,
            new EmailRequest { Email = "finnesikke@test.no" });

        // Assert — returnerer alltid 200 for å forhindre email enumeration
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // ======================== 401 — epost ikke bekreftet ========================

    [Fact]
    public async Task ForgotPassword_WhenEmailNotConfirmed_ShouldReturn401WithEmailNotConfirmed()
    {
        // Arrange
        var user = new UserBuilder().AsEmailUnverified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        // Act
        var response = await _client.PostAsJsonAsync(
            Endpoints.PasswordReset.ForgotPassword,
            new EmailRequest { Email = user.Email! });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.EmailNotConfirmed);
    }

    // ======================== 401 — telefon ikke bekreftet ========================

    [Fact]
    public async Task ForgotPassword_WhenPhoneNotConfirmed_ShouldReturn401WithPhoneNotConfirmed()
    {
        // Arrange — epost er bekreftet, men telefon er ikke bekreftet
        var user = new UserBuilder().AsPhoneUnverified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        // Act
        var response = await _client.PostAsJsonAsync(
            Endpoints.PasswordReset.ForgotPassword,
            new EmailRequest { Email = user.Email! });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.PhoneNotConfirmed);
    }

    // ======================== 429 — IP-basert e-post-rate-limit overskredet ========================

    [Fact]
    public async Task ForgotPassword_WhenIpEmailRateLimitExceeded_ShouldReturn429WithTooManyRequests()
    {
        // Arrange — pre-fyll IP-bucketen til grensen ved å registrere e-poster direkte
        // i in-memory-tjenesten. Unngår ekstra HTTP-kall og isolerer mot andre tester via unik IP.
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        await using var scope = _factory.Services.CreateAsyncScope();
        var emailRateLimiter = scope.ServiceProvider.GetRequiredService<IEmailRateLimitService>();
        for (var i = 0; i < EmailRateConfig.MaxEmailsPerIpPerHour; i++)
            emailRateLimiter.RegisterEmailSent(
                EmailType.PasswordReset, $"filler-{i}-{_uniqueIp}@test.no", _uniqueIp);

        // Act — én forespørsel til → IP-grensen er nådd
        var response = await _client.PostAsJsonAsync(
            Endpoints.PasswordReset.ForgotPassword,
            new EmailRequest { Email = user.Email! });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.TooManyRequests);
    }

    // ======================== 500 — e-posttjenesten feiler ========================

    [Fact]
    public async Task ForgotPassword_WhenEmailServiceFails_ShouldReturn500WithInternalError()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        var failingEmailService = new Mock<IEmailService>();
        failingEmailService
            .Setup(e => e.SendAsync(It.IsAny<string>(), It.IsAny<EmailBody>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure("SMTP error", AppErrorCode.InternalError));

        var id = Interlocked.Increment(ref _testCounter);
        var client = _factory
            .WithWebHostBuilder(b => b.ConfigureServices(services =>
            {
                services.RemoveAll<IEmailService>();
                services.AddSingleton(failingEmailService.Object);
            }))
            .CreateClient();

        client.DefaultRequestHeaders.TryAddWithoutValidation(
            "User-Agent", $"Mozilla/5.0 Chrome/{id * 100 + 70000}.0 ForgotPasswordTest");
        client.DefaultRequestHeaders.TryAddWithoutValidation("X-Forwarded-For", $"10.7.0.{id}");

        // Act
        var response = await client.PostAsJsonAsync(
            Endpoints.PasswordReset.ForgotPassword,
            new EmailRequest { Email = user.Email! });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.InternalServerError);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.InternalError);
    }
}
