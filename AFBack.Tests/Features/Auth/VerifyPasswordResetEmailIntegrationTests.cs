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
public class VerifyPasswordResetEmailIntegrationTests : IAsyncLifetime
{
    private readonly BackendApplicationFactory _factory;
    private readonly HttpClient _client;

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    // VerifyPasswordResetEmail-tester bruker User-Agent-versjonsspenn 80100+ og IP-prefix 10.8.0.x.
    private static int _testCounter;

    public VerifyPasswordResetEmailIntegrationTests(BackendApplicationFactory factory)
    {
        _factory = factory;
        var id = Interlocked.Increment(ref _testCounter);
        _client = factory.CreateClientWithIp($"10.8.0.{id}");
        _client.DefaultRequestHeaders.TryAddWithoutValidation(
            "User-Agent", $"Mozilla/5.0 Chrome/{id * 100 + 80000}.0 VerifyPasswordResetEmailTest");
    }

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync()
    {
        await _factory.ResetDatabaseAsync();
        await _factory.ResetRedisAsync();
    }

    // ======================== Hjelpemetoder ========================

    /// <summary>
    /// Seeder en epost-reset-kode direkte i databasen.
    /// Unngår å kalle forgot-password-endepunktet og dermed e-post-rate-limiteren.
    /// </summary>
    private async Task<(string Code, string UserId)> SeedEmailResetCodeAsync(string email)
    {
        const string code = "123456";

        var userId = await _factory.QueryAsync(async db =>
            (await db.AppUsers.AsNoTracking().FirstAsync(u => u.Email == email)).Id);

        await _factory.SeedAsync(async db =>
        {
            var vi = await db.VerificationInfos.FirstAsync(v => v.UserId == userId);
            vi.EmailPasswordResetCode          = code;
            vi.EmailPasswordResetCodeExpiresAt = DateTime.UtcNow.AddMinutes(30);
            vi.EmailPasswordResetCodeFailedAttempts = 0;
            vi.EmailPasswordResetVerified      = false;
            vi.SmsPasswordResetVerified        = false;
            await db.SaveChangesAsync();
        });

        return (code, userId);
    }

    // ======================== 200 OK ========================

    [Fact]
    public async Task VerifyPasswordResetEmail_WithValidCode_ShouldReturn200()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);
        var (code, _) = await SeedEmailResetCodeAsync(user.Email!);

        // Act
        var response = await _client.PostAsJsonAsync(
            Endpoints.PasswordReset.VerifyResetEmail,
            new VerifyEmailRequest { Email = user.Email!, Code = code });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // ======================== 401 Unauthorized — bruker ikke funnet ========================

    [Fact]
    public async Task VerifyPasswordResetEmail_WhenUserDoesNotExist_ShouldReturn401WithUnauthorized()
    {
        // Arrange — ingen bruker seedes
        // Act
        var response = await _client.PostAsJsonAsync(
            Endpoints.PasswordReset.VerifyResetEmail,
            new VerifyEmailRequest { Email = "finnesikke@test.no", Code = "123456" });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.Unauthorized);
    }

    // ======================== 422 Unprocessable — feil kode ========================

    [Fact]
    public async Task VerifyPasswordResetEmail_WithWrongCode_ShouldReturn422WithInvalidCode()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);
        await SeedEmailResetCodeAsync(user.Email!);

        // Act — bruk feil kode
        var response = await _client.PostAsJsonAsync(
            Endpoints.PasswordReset.VerifyResetEmail,
            new VerifyEmailRequest { Email = user.Email!, Code = "000000" });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.InvalidCode);
    }

    // ======================== 400 Bad Request — utløpt kode ========================

    [Fact]
    public async Task VerifyPasswordResetEmail_WithExpiredCode_ShouldReturn400WithExpiredCode()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);
        var (code, userId) = await SeedEmailResetCodeAsync(user.Email!);

        // Sett koden som utløpt
        await _factory.SeedAsync(async db =>
        {
            var vi = await db.VerificationInfos.FirstAsync(v => v.UserId == userId);
            vi.EmailPasswordResetCodeExpiresAt = DateTime.UtcNow.AddMinutes(-5);
            await db.SaveChangesAsync();
        });

        // Act
        var response = await _client.PostAsJsonAsync(
            Endpoints.PasswordReset.VerifyResetEmail,
            new VerifyEmailRequest { Email = user.Email!, Code = code });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.ExpiredCode);
    }

    // ======================== 429 Too Many Requests — for mange forsøk ========================

    [Fact]
    public async Task VerifyPasswordResetEmail_WhenMaxAttemptsExceeded_ShouldReturn429WithTooManyRequests()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);
        var (code, userId) = await SeedEmailResetCodeAsync(user.Email!);

        // Sett forsøksteller til maksgrensen
        await _factory.SeedAsync(async db =>
        {
            var vi = await db.VerificationInfos.FirstAsync(v => v.UserId == userId);
            vi.EmailPasswordResetCodeFailedAttempts = VerificationConfig.MaxFailedAttempts;
            await db.SaveChangesAsync();
        });

        // Act
        var response = await _client.PostAsJsonAsync(
            Endpoints.PasswordReset.VerifyResetEmail,
            new VerifyEmailRequest { Email = user.Email!, Code = code });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.TooManyRequests);
    }
}
