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
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Moq;

namespace AFBack.Tests.Features.Auth;

[Collection(nameof(IntegrationTestsCollection))]
public class SendPasswordResetSmsIntegrationTests : IAsyncLifetime
{
    private readonly BackendApplicationFactory _factory;
    private readonly HttpClient _client;
    private readonly string _uniqueIp;

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    // SendPasswordResetSms-tester bruker User-Agent-versjonsspenn 90100+ og IP-prefix 10.9.0.x.
    private static int _testCounter;

    public SendPasswordResetSmsIntegrationTests(BackendApplicationFactory factory)
    {
        _factory = factory;
        var id = Interlocked.Increment(ref _testCounter);
        _uniqueIp = $"10.9.0.{id}";
        _client = factory.CreateClientWithIp(_uniqueIp);
        _client.DefaultRequestHeaders.TryAddWithoutValidation(
            "User-Agent", $"Mozilla/5.0 Chrome/{id * 100 + 90000}.0 SendPasswordResetSmsTest");
    }

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync()
    {
        await _factory.ResetDatabaseAsync();
        await _factory.ResetRedisAsync();
    }

    // ======================== Hjelpemetoder ========================

    private async Task SeedEmailVerifiedAsync(string email)
    {
        var userId = await _factory.QueryAsync(async db =>
            (await db.AppUsers.AsNoTracking().FirstAsync(u => u.Email == email)).Id);

        await _factory.SeedAsync(async db =>
        {
            var vi = await db.VerificationInfos.FirstAsync(v => v.UserId == userId);
            vi.EmailPasswordResetVerified = true;
            await db.SaveChangesAsync();
        });
    }

    // ======================== 200 OK ========================

    [Fact]
    public async Task SendPasswordResetSms_AfterEmailVerification_ShouldReturn200AndSetSmsCodeInDatabase()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);
        await SeedEmailVerifiedAsync(user.Email!);

        // Act
        var response = await _client.PostAsJsonAsync(
            Endpoints.PasswordReset.SendResetSms,
            new EmailRequest { Email = user.Email! });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var codeSet = await _factory.QueryAsync(async db =>
        {
            var vi = await db.VerificationInfos.AsNoTracking()
                             .FirstAsync(v => v.UserId == user.Id);
            return vi.SmsPasswordResetCode != null;
        });
        codeSet.Should().BeTrue();
    }

    // ======================== 401 Unauthorized — bruker ikke funnet ========================

    [Fact]
    public async Task SendPasswordResetSms_WhenUserDoesNotExist_ShouldReturn401WithUnauthorized()
    {
        // Arrange — ingen bruker seedes
        // Act
        var response = await _client.PostAsJsonAsync(
            Endpoints.PasswordReset.SendResetSms,
            new EmailRequest { Email = "finnesikke@test.no" });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.Unauthorized);
    }

    // ======================== 429 — IP-basert SMS-rate-limit overskredet ========================

    [Fact]
    public async Task SendPasswordResetSms_WhenIpSmsRateLimitExceeded_ShouldReturn429WithTooManyRequests()
    {
        // Arrange — pre-fyll IP-bucketen til grensen ved å registrere SMS-er direkte
        // i in-memory-tjenesten. Unik IP isolerer mot andre tester.
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);
        await SeedEmailVerifiedAsync(user.Email!);

        await using var scope = _factory.Services.CreateAsyncScope();
        var smsRateLimiter = scope.ServiceProvider.GetRequiredService<ISmsRateLimitService>();
        for (var i = 0; i < SmsRateLimitConfig.MaxSmsPerIpPerHour; i++)
            smsRateLimiter.RegisterSmsSent(
                SmsType.PasswordReset, $"+4799{i:000000}", _uniqueIp);

        // Act — én forespørsel til → IP-grensen er nådd
        var response = await _client.PostAsJsonAsync(
            Endpoints.PasswordReset.SendResetSms,
            new EmailRequest { Email = user.Email! });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.TooManyRequests);
    }

    // ======================== 500 — SMS-tjenesten feiler ========================

    [Fact]
    public async Task SendPasswordResetSms_WhenSmsServiceFails_ShouldReturn500WithInternalError()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);
        await SeedEmailVerifiedAsync(user.Email!);

        var failingSmsService = new Mock<ISmsService>();
        failingSmsService
            .Setup(s => s.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure("SMS gateway feil", AppErrorCode.InternalError));

        var id = Interlocked.Increment(ref _testCounter);
        var client = _factory
            .WithWebHostBuilder(b => b.ConfigureServices(services =>
            {
                services.RemoveAll<ISmsService>();
                services.AddSingleton(failingSmsService.Object);
            }))
            .CreateClient();

        client.DefaultRequestHeaders.TryAddWithoutValidation(
            "User-Agent", $"Mozilla/5.0 Chrome/{id * 100 + 90000}.0 SendPasswordResetSmsTest");
        client.DefaultRequestHeaders.TryAddWithoutValidation("X-Forwarded-For", $"10.9.0.{id}");

        // Act
        var response = await client.PostAsJsonAsync(
            Endpoints.PasswordReset.SendResetSms,
            new EmailRequest { Email = user.Email! });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.InternalServerError);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.InternalError);
    }
}
