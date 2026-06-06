using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Configurations.Options;
using AFBack.Features.Auth.DTOs.Request;
using AFBack.Tests.Builders;
using AFBack.Tests.Common;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Tests.Features.Auth;

[Collection(nameof(IntegrationTestsCollection))]
public class VerifyPasswordResetSmsIntegrationTests : IAsyncLifetime
{
    private readonly BackendApplicationFactory _factory;
    private readonly HttpClient _client;

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    // VerifyPasswordResetSms-tester bruker User-Agent-versjonsspenn 100100+ og IP-prefix 10.10.0.x.
    private static int _testCounter;

    public VerifyPasswordResetSmsIntegrationTests(BackendApplicationFactory factory)
    {
        _factory = factory;
        var id = Interlocked.Increment(ref _testCounter);
        _client = factory.CreateClientWithIp($"10.10.0.{id}");
        _client.DefaultRequestHeaders.TryAddWithoutValidation(
            "User-Agent", $"Mozilla/5.0 Chrome/{id * 100 + 100000}.0 VerifyPasswordResetSmsTest");
    }

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync()
    {
        await _factory.ResetDatabaseAsync();
        await _factory.ResetRedisAsync();
    }

    // ======================== Hjelpemetoder ========================

    /// <summary>
    /// Seeder epost-steget (EmailPasswordResetVerified = true) og en SMS-kode direkte i databasen.
    /// Unngår å kalle forgot-password og send-sms-endepunktene slik at e-post-rate-limiteren ikke treffes.
    /// </summary>
    private async Task<(string SmsCode, string UserId)> SeedSmsResetCodeAsync(string email)
    {
        const string smsCode = "654321";

        var userId = await _factory.QueryAsync(async db =>
            (await db.AppUsers.AsNoTracking().FirstAsync(u => u.Email == email)).Id);

        await _factory.SeedAsync(async db =>
        {
            var vi = await db.VerificationInfos.FirstAsync(v => v.UserId == userId);
            vi.EmailPasswordResetVerified         = true;
            vi.SmsPasswordResetCode               = smsCode;
            vi.SmsPasswordResetCodeExpiresAt      = DateTime.UtcNow.AddMinutes(10);
            vi.SmsPasswordResetCodeFailedAttempts = 0;
            vi.SmsPasswordResetVerified           = false;
            await db.SaveChangesAsync();
        });

        return (smsCode, userId);
    }

    // ======================== 200 OK ========================

    [Fact]
    public async Task VerifyPasswordResetSms_WithValidCode_ShouldReturn200()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);
        var (smsCode, _) = await SeedSmsResetCodeAsync(user.Email!);

        // Act
        var response = await _client.PostAsJsonAsync(
            Endpoints.PasswordReset.VerifyResetSms,
            new VerifyEmailRequest { Email = user.Email!, Code = smsCode });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // ======================== 401 Unauthorized — bruker ikke funnet ========================

    [Fact]
    public async Task VerifyPasswordResetSms_WhenUserDoesNotExist_ShouldReturn401WithUnauthorized()
    {
        // Arrange — ingen bruker seedes
        // Act
        var response = await _client.PostAsJsonAsync(
            Endpoints.PasswordReset.VerifyResetSms,
            new VerifyEmailRequest { Email = "finnesikke@test.no", Code = "123456" });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.Unauthorized);
    }

    // ======================== 422 Unprocessable — feil kode ========================

    [Fact]
    public async Task VerifyPasswordResetSms_WithWrongCode_ShouldReturn422WithInvalidCode()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);
        await SeedSmsResetCodeAsync(user.Email!);

        // Act — bruk feil kode
        var response = await _client.PostAsJsonAsync(
            Endpoints.PasswordReset.VerifyResetSms,
            new VerifyEmailRequest { Email = user.Email!, Code = "000000" });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.InvalidCode);
    }

    // ======================== 400 Bad Request — utløpt kode ========================

    [Fact]
    public async Task VerifyPasswordResetSms_WithExpiredCode_ShouldReturn400WithExpiredCode()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);
        var (smsCode, userId) = await SeedSmsResetCodeAsync(user.Email!);

        // Sett SMS-koden som utløpt
        await _factory.SeedAsync(async db =>
        {
            var vi = await db.VerificationInfos.FirstAsync(v => v.UserId == userId);
            vi.SmsPasswordResetCodeExpiresAt = DateTime.UtcNow.AddMinutes(-5);
            await db.SaveChangesAsync();
        });

        // Act
        var response = await _client.PostAsJsonAsync(
            Endpoints.PasswordReset.VerifyResetSms,
            new VerifyEmailRequest { Email = user.Email!, Code = smsCode });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.ExpiredCode);
    }

    // ======================== 429 Too Many Requests — for mange forsøk ========================

    [Fact]
    public async Task VerifyPasswordResetSms_WhenMaxAttemptsExceeded_ShouldReturn429WithTooManyRequests()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);
        var (smsCode, userId) = await SeedSmsResetCodeAsync(user.Email!);

        // Sett forsøksteller til maksgrensen
        await _factory.SeedAsync(async db =>
        {
            var vi = await db.VerificationInfos.FirstAsync(v => v.UserId == userId);
            vi.SmsPasswordResetCodeFailedAttempts = VerificationConfig.MaxFailedAttempts;
            await db.SaveChangesAsync();
        });

        // Act
        var response = await _client.PostAsJsonAsync(
            Endpoints.PasswordReset.VerifyResetSms,
            new VerifyEmailRequest { Email = user.Email!, Code = smsCode });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.TooManyRequests);
    }
}
