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
public class VerifyEmailIntegrationTests : IAsyncLifetime
{
    private readonly BackendApplicationFactory _factory;
    private readonly HttpClient _client;

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    // Unik User-Agent per instans → unik fingerprint → egen rate-limit-bucket per test.
    // VerifyEmail-tester bruker versjonsspenn 30100+.
    private static int _testCounter;

    public VerifyEmailIntegrationTests(BackendApplicationFactory factory)
    {
        _factory = factory;
        var id = Interlocked.Increment(ref _testCounter);
        _client = factory.CreateClientWithIp();
        _client.DefaultRequestHeaders.TryAddWithoutValidation(
            "User-Agent", $"Mozilla/5.0 Chrome/{id * 100 + 30000}.0 VerifyEmailTest");
    }

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync()
    {
        await _factory.ResetDatabaseAsync();
        await _factory.ResetRedisAsync();
    }

    // ======================== Hjelpemetoder ========================

    /// <summary>
    /// Registrerer en ny bruker via signup og returnerer e-postkoden som ble generert.
    /// Eposttjenesten er mocka — koden leses direkte fra databasen.
    /// </summary>
    private async Task<(string Email, string UserId, string Code)> SignupAndGetEmailCodeAsync()
    {
        var request = new SignupRequest
        {
            Email       = $"verify-{Guid.NewGuid():N}@test.no",
            Password    = TestConstants.Users.DefaultPassword,
            FirstName   = TestConstants.Users.DefaultFirstName,
            LastName    = TestConstants.Users.DefaultLastName,
            PhoneNumber = $"+4799{Random.Shared.Next(100_000, 999_999)}",
            DateOfBirth = new DateOnly(1995, 6, 15),
            CountryCode = "NO",
        };

        var signupResponse = await _client.PostAsJsonAsync(Endpoints.Auth.Signup, request);
        signupResponse.EnsureSuccessStatusCode();

        var (userId, code) = await _factory.QueryAsync(async db =>
        {
            var user = await db.AppUsers.AsNoTracking()
                               .FirstAsync(u => u.Email == request.Email);
            var vi = await db.VerificationInfos.AsNoTracking()
                             .FirstAsync(vi => vi.UserId == user.Id);
            return (user.Id, vi.EmailConfirmationCode!);
        });

        return (request.Email, userId, code);
    }

    // ======================== 200 OK ========================

    [Fact]
    public async Task VerifyEmail_WithValidCode_ShouldReturn200()
    {
        // Arrange — signup genererer kode automatisk
        var (email, _, code) = await SignupAndGetEmailCodeAsync();

        // Act
        var response = await _client.PostAsJsonAsync(
            Endpoints.Verification.VerifyEmail,
            new VerifyEmailRequest { Email = email, Code = code });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task VerifyEmail_WithValidCode_ShouldSetEmailConfirmedInDatabase()
    {
        // Arrange
        var (email, userId, code) = await SignupAndGetEmailCodeAsync();

        // Act
        await _client.PostAsJsonAsync(
            Endpoints.Verification.VerifyEmail,
            new VerifyEmailRequest { Email = email, Code = code });

        // Assert — EmailConfirmed er nå true i databasen
        var emailConfirmed = await _factory.QueryAsync(async db =>
        {
            var user = await db.AppUsers.AsNoTracking().FirstAsync(u => u.Id == userId);
            return user.EmailConfirmed;
        });

        emailConfirmed.Should().BeTrue();
    }

    // ======================== 401 Unauthorized — bruker ikke funnet ========================

    [Fact]
    public async Task VerifyEmail_WhenUserDoesNotExist_ShouldReturn401WithUnauthorizedCode()
    {
        // Arrange — ingen bruker seedes
        var request = new VerifyEmailRequest { Email = "finnesikke@test.no", Code = "123456" };

        // Act
        var response = await _client.PostAsJsonAsync(Endpoints.Verification.VerifyEmail, request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.Unauthorized);
    }

    // ======================== 409 Conflict — allerede verifisert ========================

    [Fact]
    public async Task VerifyEmail_WhenEmailAlreadyConfirmed_ShouldReturn409WithConflictCode()
    {
        // Arrange — seed en allerede verifisert bruker
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        // Act
        var response = await _client.PostAsJsonAsync(
            Endpoints.Verification.VerifyEmail,
            new VerifyEmailRequest { Email = user.Email!, Code = "123456" });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.Conflict);
    }

    // ======================== 422 Unprocessable — feil kode ========================

    [Fact]
    public async Task VerifyEmail_WithWrongCode_ShouldReturn422WithInvalidCode()
    {
        // Arrange
        var (email, _, _) = await SignupAndGetEmailCodeAsync();

        // Act — bruk feil kode
        var response = await _client.PostAsJsonAsync(
            Endpoints.Verification.VerifyEmail,
            new VerifyEmailRequest { Email = email, Code = "000000" });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.InvalidCode);
    }

    // ======================== 400 Bad Request — utløpt kode ========================

    [Fact]
    public async Task VerifyEmail_WithExpiredCode_ShouldReturn400WithExpiredCode()
    {
        // Arrange
        var (email, userId, code) = await SignupAndGetEmailCodeAsync();

        // Sett koden som utløpt direkte i databasen
        await _factory.SeedAsync(async db =>
        {
            var vi = await db.VerificationInfos.FirstAsync(v => v.UserId == userId);
            vi.EmailCodeExpiresAt = DateTime.UtcNow.AddMinutes(-5);
            await db.SaveChangesAsync();
        });

        // Act — riktig kode, men utløpt
        var response = await _client.PostAsJsonAsync(
            Endpoints.Verification.VerifyEmail,
            new VerifyEmailRequest { Email = email, Code = code });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.ExpiredCode);
    }

    // ======================== 429 Too Many Requests — for mange forsøk ========================

    [Fact]
    public async Task VerifyEmail_WhenMaxAttemptsExceeded_ShouldReturn429WithTooManyRequests()
    {
        // Arrange
        var (email, userId, code) = await SignupAndGetEmailCodeAsync();

        // Sett forsøksteller til maksgrensen
        await _factory.SeedAsync(async db =>
        {
            var vi = await db.VerificationInfos.FirstAsync(v => v.UserId == userId);
            vi.EmailCodeFailedAttempts = VerificationConfig.MaxFailedAttempts;
            await db.SaveChangesAsync();
        });

        // Act — riktig kode, men utestengt
        var response = await _client.PostAsJsonAsync(
            Endpoints.Verification.VerifyEmail,
            new VerifyEmailRequest { Email = email, Code = code });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.TooManyRequests);
    }
}
