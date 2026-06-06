using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Features.Auth.DTOs.Request;
using AFBack.Infrastructure.Email;
using AFBack.Infrastructure.Email.Enums;
using AFBack.Infrastructure.Email.Models;
using AFBack.Infrastructure.Security.Services;
using AFBack.Tests.Builders;
using AFBack.Tests.Common;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Moq;

namespace AFBack.Tests.Features.Auth;

[Collection(nameof(IntegrationTestsCollection))]
public class ResendVerificationEmailIntegrationTests : IAsyncLifetime
{
    private readonly BackendApplicationFactory _factory;
    private readonly HttpClient _client;

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    // Unik User-Agent per instans → unik fingerprint → egen rate-limit-bucket per test.
    // ResendVerificationEmail-tester bruker versjonsspenn 40100+.
    private static int _testCounter;

    public ResendVerificationEmailIntegrationTests(BackendApplicationFactory factory)
    {
        _factory = factory;
        var id = Interlocked.Increment(ref _testCounter);
        _client = factory.CreateClientWithIp();
        _client.DefaultRequestHeaders.TryAddWithoutValidation(
            "User-Agent", $"Mozilla/5.0 Chrome/{id * 100 + 40000}.0 ResendVerifyTest");
    }

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync()
    {
        await _factory.ResetDatabaseAsync();
        await _factory.ResetRedisAsync();
    }

    // ======================== 200 OK — happy path ========================

    [Fact]
    public async Task ResendVerification_WithUnverifiedUser_ShouldReturn200()
    {
        // Arrange — bruker med ubekreftet e-post
        var user = new UserBuilder().AsEmailUnverified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        // Act
        var response = await _client.PostAsJsonAsync(
            Endpoints.Verification.ResendEmail,
            new EmailRequest { Email = user.Email! });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // ======================== 200 OK — anti-enumeration ========================

    [Fact]
    public async Task ResendVerification_WhenUserDoesNotExist_ShouldReturn200ToPreventEnumeration()
    {
        // Arrange — ingen bruker seedes
        // Act
        var response = await _client.PostAsJsonAsync(
            Endpoints.Verification.ResendEmail,
            new EmailRequest { Email = "finnesikke@test.no" });

        // Assert — avslør ikke at adressen ikke finnes
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task ResendVerification_WhenEmailAlreadyConfirmed_ShouldReturn200ToPreventEnumeration()
    {
        // Arrange — allerede bekreftet bruker
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        // Act
        var response = await _client.PostAsJsonAsync(
            Endpoints.Verification.ResendEmail,
            new EmailRequest { Email = user.Email! });

        // Assert — avslør ikke at e-posten allerede er bekreftet
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // ======================== 429 Too Many Requests — rate limit ========================

    [Fact]
    public async Task ResendVerification_WhenIpRateLimitExceeded_ShouldReturn429WithTooManyRequestsCode()
    {
        // Arrange — fyll IP-kvoten for denne unike IP-adressen
        var uniqueIp = $"10.88.{Random.Shared.Next(1, 254)}.{Random.Shared.Next(1, 254)}";
        var rateLimitService = _factory.Services.GetRequiredService<IEmailRateLimitService>();

        for (var i = 0; i < AFBack.Configurations.Options.EmailRateConfig.MaxEmailsPerIpPerHour; i++)
            rateLimitService.RegisterEmailSent(EmailType.Verification, $"fyll{i}@test.no", uniqueIp);

        var user = new UserBuilder().AsEmailUnverified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        var client = _factory.CreateClientWithIp(uniqueIp);
        client.DefaultRequestHeaders.TryAddWithoutValidation(
            "User-Agent", "Mozilla/5.0 Chrome/99997.0 ResendRateLimitTest");

        // Act
        var response = await client.PostAsJsonAsync(
            Endpoints.Verification.ResendEmail,
            new EmailRequest { Email = user.Email! });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.TooManyRequests);
    }

    // ======================== 500 Internal Server Error — e-post feiler ========================

    [Fact]
    public async Task ResendVerification_WhenEmailServiceFails_ShouldReturn500WithInternalError()
    {
        // Arrange
        var user = new UserBuilder().AsEmailUnverified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        var failingMock = new Mock<IEmailService>();
        failingMock
            .Setup(s => s.SendAsync(
                It.IsAny<string>(), It.IsAny<EmailBody>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure("SMTP unavailable", AppErrorCode.InternalError));

        var client = _factory.WithWebHostBuilder(b =>
            b.ConfigureServices(services =>
            {
                services.RemoveAll<IEmailService>();
                services.AddScoped(_ => failingMock.Object);
            })).CreateClient();

        client.DefaultRequestHeaders.TryAddWithoutValidation("X-Forwarded-For", "127.0.0.1");
        client.DefaultRequestHeaders.TryAddWithoutValidation(
            "User-Agent", "Mozilla/5.0 Chrome/99996.0 ResendEmailFailTest");

        // Act
        var response = await client.PostAsJsonAsync(
            Endpoints.Verification.ResendEmail,
            new EmailRequest { Email = user.Email! });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.InternalServerError);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.InternalError);
    }
}
