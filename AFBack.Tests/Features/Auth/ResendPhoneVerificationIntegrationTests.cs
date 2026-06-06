using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Configurations.Options;
using AFBack.Features.Auth.DTOs.Request;
using AFBack.Infrastructure.Security.Services;
using AFBack.Infrastructure.Sms.Enums;
using AFBack.Infrastructure.Sms.Services;
using AFBack.Tests.Builders;
using AFBack.Tests.Common;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Moq;

namespace AFBack.Tests.Features.Auth;

[Collection(nameof(IntegrationTestsCollection))]
public class ResendPhoneVerificationIntegrationTests : IAsyncLifetime
{
    private readonly BackendApplicationFactory _factory;
    private readonly HttpClient _client;

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    // Unik User-Agent per instans → unik fingerprint → egen rate-limit-bucket per test.
    // ResendPhoneVerification-tester bruker versjonsspenn 60100+.
    private static int _testCounter;

    public ResendPhoneVerificationIntegrationTests(BackendApplicationFactory factory)
    {
        _factory = factory;
        var id = Interlocked.Increment(ref _testCounter);
        _client = factory.CreateClientWithIp();
        _client.DefaultRequestHeaders.TryAddWithoutValidation(
            "User-Agent", $"Mozilla/5.0 Chrome/{id * 100 + 60000}.0 ResendPhoneTest");
    }

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync()
    {
        await _factory.ResetDatabaseAsync();
        await _factory.ResetRedisAsync();
    }

    // ======================== 200 OK — happy path ========================

    [Fact]
    public async Task ResendPhoneVerification_WithPhoneUnverifiedUser_ShouldReturn200()
    {
        // Arrange
        var user = new UserBuilder().AsPhoneUnverified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        // Act
        var response = await _client.PostAsJsonAsync(
            Endpoints.Verification.ResendPhone,
            new EmailRequest { Email = user.Email! });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // ======================== 200 OK — anti-enumeration ========================

    [Fact]
    public async Task ResendPhoneVerification_WhenUserDoesNotExist_ShouldReturn200ToPreventEnumeration()
    {
        // Arrange — ingen bruker seedes
        // Act
        var response = await _client.PostAsJsonAsync(
            Endpoints.Verification.ResendPhone,
            new EmailRequest { Email = "finnesikke@test.no" });

        // Assert — avslør ikke at adressen ikke finnes
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task ResendPhoneVerification_WhenPhoneAlreadyConfirmed_ShouldReturn200ToPreventEnumeration()
    {
        // Arrange — fullstendig verifisert bruker
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        // Act
        var response = await _client.PostAsJsonAsync(
            Endpoints.Verification.ResendPhone,
            new EmailRequest { Email = user.Email! });

        // Assert — avslør ikke at telefon allerede er bekreftet
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // ======================== 429 Too Many Requests — rate limit ========================

    [Fact]
    public async Task ResendPhoneVerification_WhenIpRateLimitExceeded_ShouldReturn429WithTooManyRequestsCode()
    {
        // Arrange — fyll IP-kvoten for SMS
        var uniqueIp = $"10.77.{Random.Shared.Next(1, 254)}.{Random.Shared.Next(1, 254)}";
        var smsRateLimitService = _factory.Services.GetRequiredService<ISmsRateLimitService>();

        for (var i = 0; i < SmsRateLimitConfig.MaxSmsPerIpPerHour; i++)
            smsRateLimitService.RegisterSmsSent(SmsType.Verification, $"+4799{100_000 + i}", uniqueIp);

        var user = new UserBuilder().AsPhoneUnverified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        var client = _factory.CreateClientWithIp(uniqueIp);
        client.DefaultRequestHeaders.TryAddWithoutValidation(
            "User-Agent", "Mozilla/5.0 Chrome/99995.0 ResendPhoneRateLimitTest");

        // Act
        var response = await client.PostAsJsonAsync(
            Endpoints.Verification.ResendPhone,
            new EmailRequest { Email = user.Email! });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.TooManyRequests);
    }

    // ======================== 500 Internal Server Error — SMS-tjenesten feiler ========================

    [Fact]
    public async Task ResendPhoneVerification_WhenSmsServiceFails_ShouldReturn500WithInternalError()
    {
        // Arrange
        var user = new UserBuilder().AsPhoneUnverified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        var failingMock = new Mock<ISmsService>();
        failingMock
            .Setup(s => s.SendAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure("SMS gateway unavailable", AppErrorCode.InternalError));

        var client = _factory.WithWebHostBuilder(b =>
            b.ConfigureServices(services =>
            {
                services.RemoveAll<ISmsService>();
                services.AddScoped(_ => failingMock.Object);
            })).CreateClient();

        client.DefaultRequestHeaders.TryAddWithoutValidation("X-Forwarded-For", "127.0.0.1");
        client.DefaultRequestHeaders.TryAddWithoutValidation(
            "User-Agent", "Mozilla/5.0 Chrome/99994.0 ResendPhoneSmsFailTest");

        // Act
        var response = await client.PostAsJsonAsync(
            Endpoints.Verification.ResendPhone,
            new EmailRequest { Email = user.Email! });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.InternalServerError);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.InternalError);
    }
}
