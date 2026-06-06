using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Configurations.Options;
using AFBack.Features.Auth.DTOs.Request;
using AFBack.Features.Auth.DTOs.Response;
using AFBack.Features.Auth.Enums;
using AFBack.Tests.Builders;
using AFBack.Tests.Common;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Tests.Features.Auth;

[Collection(nameof(IntegrationTestsCollection))]
public class VerifyMfaIntegrationTests : IAsyncLifetime
{
    private readonly BackendApplicationFactory _factory;
    private readonly HttpClient _client;

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    // Unik User-Agent per instans → unik fingerprint → egen rate-limit-bucket per test.
    // VerifyMfa-tester bruker versjonsspenn 20100+.
    private static int _testCounter;

    public VerifyMfaIntegrationTests(BackendApplicationFactory factory)
    {
        _factory = factory;
        var id = Interlocked.Increment(ref _testCounter);
        _client = factory.CreateClientWithIp();
        _client.DefaultRequestHeaders.TryAddWithoutValidation(
            "User-Agent", $"Mozilla/5.0 Chrome/{id * 100 + 20000}.0 VerifyMfaTest");
    }

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync()
    {
        await _factory.ResetDatabaseAsync();
        await _factory.ResetRedisAsync();
    }

    // ======================== Hjelpemetoder ========================

    /// <summary>
    /// Gjennomfører steg 1 (login) og returnerer MFA-koden fra databasen.
    /// Eposttjenesten er mocka — koden leses direkte fra DB.
    /// </summary>
    private async Task<(string MfaCode, string UserId)> CompleteStep1Async(
        string email, string password, string fingerprint)
    {
        var step1Response = await _client.PostAsJsonAsync(
            Endpoints.Auth.Login,
            new LoginRequest
            {
                Email    = email,
                Password = password,
                Device   = MakeDevice(fingerprint),
            });

        step1Response.EnsureSuccessStatusCode();

        var (mfaCode, userId) = await _factory.QueryAsync(async db =>
        {
            var user = await db.AppUsers.AsNoTracking()
                               .FirstAsync(u => u.Email == email);
            var vi = await db.VerificationInfos.AsNoTracking()
                             .FirstAsync(vi => vi.UserId == user.Id);
            return (vi.LoginMfaCode!, user.Id);
        });

        return (mfaCode, userId);
    }

    private static VerifyMfaRequest MakeVerifyRequest(string email, string code, string fingerprint) => new()
    {
        Email  = email,
        Code   = code,
        Device = MakeDevice(fingerprint),
    };

    private static DeviceInfoRequest MakeDevice(string fingerprint) => new()
    {
        DeviceFingerprint = fingerprint,
        DeviceName        = TestConstants.Devices.DefaultDeviceName,
        DeviceType        = DeviceType.Unknown,
        OperatingSystem   = OperatingSystemType.Unknown,
    };

    // ======================== 200 OK ========================

    [Fact]
    public async Task VerifyMfa_WithValidCode_ShouldReturn200WithTokensAndUser()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        var fingerprint = Guid.NewGuid().ToString();
        var (mfaCode, _) = await CompleteStep1Async(
            user.Email!, TestConstants.Users.DefaultPassword, fingerprint);

        // Act
        var response = await _client.PostAsJsonAsync(
            Endpoints.Auth.LoginVerifyMfa,
            MakeVerifyRequest(user.Email!, mfaCode, fingerprint));

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<LoginResponse>(JsonOpts);
        body!.AccessToken.Should().NotBeNullOrEmpty();
        body.RefreshToken.Should().NotBeNullOrEmpty();
        body.AccessTokenExpires.Should().BeAfter(DateTime.UtcNow);
        body.RefreshTokenExpires.Should().BeAfter(DateTime.UtcNow);
        body.User.Should().NotBeNull();
        body.User.Id.Should().Be(user.Id);
    }

    [Fact]
    public async Task VerifyMfa_WithValidCode_ShouldPersistRefreshTokenAndLoginHistoryInDatabase()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        var fingerprint = Guid.NewGuid().ToString();
        var (mfaCode, _) = await CompleteStep1Async(
            user.Email!, TestConstants.Users.DefaultPassword, fingerprint);

        // Act
        await _client.PostAsJsonAsync(
            Endpoints.Auth.LoginVerifyMfa,
            MakeVerifyRequest(user.Email!, mfaCode, fingerprint));

        // Assert — refresh token er lagret
        var tokenExists = await _factory.QueryAsync(async db =>
            await db.RefreshTokens.AnyAsync(t => t.UserId == user.Id && !t.IsRevoked));

        tokenExists.Should().BeTrue();

        // Login-historikk er registrert
        var loginHistoryExists = await _factory.QueryAsync(async db =>
            await db.LoginHistories.AnyAsync(h => h.UserId == user.Id));

        loginHistoryExists.Should().BeTrue();
    }

    // ======================== 401 Unauthorized — bruker ikke funnet ========================

    [Fact]
    public async Task VerifyMfa_WhenUserDoesNotExist_ShouldReturn401WithUnauthorizedCode()
    {
        // Arrange — ingen bruker seedes; sender direkte til steg 2 uten steg 1
        var request = MakeVerifyRequest("finnesikke@test.no", "123456", Guid.NewGuid().ToString());

        // Act
        var response = await _client.PostAsJsonAsync(Endpoints.Auth.LoginVerifyMfa, request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.Unauthorized);
    }

    // ======================== 422 Unprocessable — feil kode ========================

    [Fact]
    public async Task VerifyMfa_WithWrongCode_ShouldReturn422WithInvalidCode()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        var fingerprint = Guid.NewGuid().ToString();
        await CompleteStep1Async(user.Email!, TestConstants.Users.DefaultPassword, fingerprint);

        // Act — bruk feil kode
        var response = await _client.PostAsJsonAsync(
            Endpoints.Auth.LoginVerifyMfa,
            MakeVerifyRequest(user.Email!, "000000", fingerprint));

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.InvalidCode);
    }

    // ======================== 400 Bad Request — utløpt kode ========================

    [Fact]
    public async Task VerifyMfa_WithExpiredCode_ShouldReturn400WithExpiredCode()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        var fingerprint = Guid.NewGuid().ToString();
        var (mfaCode, userId) = await CompleteStep1Async(
            user.Email!, TestConstants.Users.DefaultPassword, fingerprint);

        // Sett koden som utløpt direkte i databasen
        await _factory.SeedAsync(async db =>
        {
            var vi = await db.VerificationInfos.FirstAsync(v => v.UserId == userId);
            vi.LoginMfaCodeExpiresAt = DateTime.UtcNow.AddMinutes(-5);
            await db.SaveChangesAsync();
        });

        // Act — bruk den riktige koden, men den er nå utløpt
        var response = await _client.PostAsJsonAsync(
            Endpoints.Auth.LoginVerifyMfa,
            MakeVerifyRequest(user.Email!, mfaCode, fingerprint));

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.ExpiredCode);
    }

    // ======================== 429 Too Many Requests — for mange forsøk ========================

    [Fact]
    public async Task VerifyMfa_WhenMaxAttemptsExceeded_ShouldReturn429WithTooManyRequests()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        var fingerprint = Guid.NewGuid().ToString();
        var (mfaCode, userId) = await CompleteStep1Async(
            user.Email!, TestConstants.Users.DefaultPassword, fingerprint);

        // Sett forsøksteller til maksgrensen direkte i databasen
        await _factory.SeedAsync(async db =>
        {
            var vi = await db.VerificationInfos.FirstAsync(v => v.UserId == userId);
            vi.LoginMfaCodeFailedAttempts = VerificationConfig.MaxFailedAttempts;
            await db.SaveChangesAsync();
        });

        // Act — riktig kode, men brukeren er utestengt
        var response = await _client.PostAsJsonAsync(
            Endpoints.Auth.LoginVerifyMfa,
            MakeVerifyRequest(user.Email!, mfaCode, fingerprint));

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.TooManyRequests);
    }
}
