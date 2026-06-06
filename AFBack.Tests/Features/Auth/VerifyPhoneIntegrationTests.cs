using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Configurations.Options;
using AFBack.Features.Auth.DTOs.Request;
using AFBack.Features.Auth.Models;
using AFBack.Tests.Builders;
using AFBack.Tests.Common;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Tests.Features.Auth;

[Collection(nameof(IntegrationTestsCollection))]
public class VerifyPhoneIntegrationTests : IAsyncLifetime
{
    private readonly BackendApplicationFactory _factory;
    private readonly HttpClient _client;

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    // Unik User-Agent per instans → unik fingerprint → egen rate-limit-bucket per test.
    // VerifyPhone-tester bruker versjonsspenn 50100+.
    private static int _testCounter;

    public VerifyPhoneIntegrationTests(BackendApplicationFactory factory)
    {
        _factory = factory;
        var id = Interlocked.Increment(ref _testCounter);
        _client = factory.CreateClientWithIp();
        _client.DefaultRequestHeaders.TryAddWithoutValidation(
            "User-Agent", $"Mozilla/5.0 Chrome/{id * 100 + 50000}.0 VerifyPhoneTest");
    }

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync()
    {
        await _factory.ResetDatabaseAsync();
        await _factory.ResetRedisAsync();
    }

    // ======================== Hjelpemetoder ========================

    /// <summary>
    /// Seeder en telefonuverifisert bruker og setter inn en kjent SMS-kode direkte i databasen.
    /// </summary>
    private async Task<(AppUser User, string Code)> SeedPhoneUnverifiedUserWithCodeAsync()
    {
        var user = new UserBuilder().AsPhoneUnverified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        const string code = "654321";

        await _factory.SeedAsync(async db =>
        {
            var vi = await db.VerificationInfos.FirstAsync(v => v.UserId == user.Id);
            vi.PhoneVerificationCode   = code;
            vi.PhoneCodeExpiresAt      = DateTime.UtcNow.AddMinutes(10);
            vi.PhoneCodeFailedAttempts = 0;
            await db.SaveChangesAsync();
        });

        return (user, code);
    }

    // ======================== 200 OK ========================

    [Fact]
    public async Task VerifyPhone_WithValidCode_ShouldReturn200()
    {
        // Arrange
        var (user, code) = await SeedPhoneUnverifiedUserWithCodeAsync();

        // Act
        var response = await _client.PostAsJsonAsync(
            Endpoints.Verification.VerifyPhone,
            new VerifyEmailRequest { Email = user.Email!, Code = code });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task VerifyPhone_WithValidCode_ShouldSetPhoneConfirmedInDatabase()
    {
        // Arrange
        var (user, code) = await SeedPhoneUnverifiedUserWithCodeAsync();

        // Act
        await _client.PostAsJsonAsync(
            Endpoints.Verification.VerifyPhone,
            new VerifyEmailRequest { Email = user.Email!, Code = code });

        // Assert
        var phoneConfirmed = await _factory.QueryAsync(async db =>
        {
            var u = await db.AppUsers.AsNoTracking().FirstAsync(u => u.Id == user.Id);
            return u.PhoneNumberConfirmed;
        });

        phoneConfirmed.Should().BeTrue();
    }

    // ======================== 401 Unauthorized — bruker ikke funnet ========================

    [Fact]
    public async Task VerifyPhone_WhenUserDoesNotExist_ShouldReturn401WithUnauthorizedCode()
    {
        // Arrange — ingen bruker seedes
        var request = new VerifyEmailRequest { Email = "finnesikke@test.no", Code = "123456" };

        // Act
        var response = await _client.PostAsJsonAsync(Endpoints.Verification.VerifyPhone, request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.Unauthorized);
    }

    // ======================== 409 Conflict — allerede verifisert ========================

    [Fact]
    public async Task VerifyPhone_WhenPhoneAlreadyConfirmed_ShouldReturn409WithConflictCode()
    {
        // Arrange — fullstendig verifisert bruker
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        // Act
        var response = await _client.PostAsJsonAsync(
            Endpoints.Verification.VerifyPhone,
            new VerifyEmailRequest { Email = user.Email!, Code = "123456" });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.Conflict);
    }

    // ======================== 422 Unprocessable — feil kode ========================

    [Fact]
    public async Task VerifyPhone_WithWrongCode_ShouldReturn422WithInvalidCode()
    {
        // Arrange
        var (user, _) = await SeedPhoneUnverifiedUserWithCodeAsync();

        // Act — bruk feil kode
        var response = await _client.PostAsJsonAsync(
            Endpoints.Verification.VerifyPhone,
            new VerifyEmailRequest { Email = user.Email!, Code = "000000" });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.InvalidCode);
    }

    // ======================== 400 Bad Request — utløpt kode ========================

    [Fact]
    public async Task VerifyPhone_WithExpiredCode_ShouldReturn400WithExpiredCode()
    {
        // Arrange
        var (user, code) = await SeedPhoneUnverifiedUserWithCodeAsync();

        // Sett koden som utløpt
        await _factory.SeedAsync(async db =>
        {
            var vi = await db.VerificationInfos.FirstAsync(v => v.UserId == user.Id);
            vi.PhoneCodeExpiresAt = DateTime.UtcNow.AddMinutes(-5);
            await db.SaveChangesAsync();
        });

        // Act — riktig kode, men utløpt
        var response = await _client.PostAsJsonAsync(
            Endpoints.Verification.VerifyPhone,
            new VerifyEmailRequest { Email = user.Email!, Code = code });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.ExpiredCode);
    }

    // ======================== 429 Too Many Requests — for mange forsøk ========================

    [Fact]
    public async Task VerifyPhone_WhenMaxAttemptsExceeded_ShouldReturn429WithTooManyRequests()
    {
        // Arrange
        var (user, code) = await SeedPhoneUnverifiedUserWithCodeAsync();

        // Sett forsøksteller til maksgrensen
        await _factory.SeedAsync(async db =>
        {
            var vi = await db.VerificationInfos.FirstAsync(v => v.UserId == user.Id);
            vi.PhoneCodeFailedAttempts = VerificationConfig.MaxFailedAttempts;
            await db.SaveChangesAsync();
        });

        // Act — riktig kode, men utestengt
        var response = await _client.PostAsJsonAsync(
            Endpoints.Verification.VerifyPhone,
            new VerifyEmailRequest { Email = user.Email!, Code = code });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.TooManyRequests);
    }
}
