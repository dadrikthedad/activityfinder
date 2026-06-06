using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Features.Auth.DTOs.Request;
using AFBack.Features.Auth.Enums;
using AFBack.Infrastructure.Email;
using AFBack.Infrastructure.Email.Models;
using AFBack.Tests.Builders;
using AFBack.Tests.Common;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Moq;

namespace AFBack.Tests.Features.Auth;

[Collection(nameof(IntegrationTestsCollection))]
public class LoginIntegrationTests : IAsyncLifetime
{
    private readonly BackendApplicationFactory _factory;
    private readonly HttpClient _client;

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    // Unik User-Agent per instans → unik fingerprint → egen rate-limit-bucket per test.
    // Login-tester bruker versjonsspenn 10100–10600+ for å unngå kollisjon med signup (100–800).
    private static int _testCounter;

    public LoginIntegrationTests(BackendApplicationFactory factory)
    {
        _factory = factory;
        var id = Interlocked.Increment(ref _testCounter);
        _client  = factory.CreateClientWithIp();
        _client.DefaultRequestHeaders.TryAddWithoutValidation(
            "User-Agent", $"Mozilla/5.0 Chrome/{id * 100 + 10000}.0 LoginTest");
    }

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync()
    {
        await _factory.ResetDatabaseAsync();
        await _factory.ResetRedisAsync();
    }

    // ======================== 200 OK ========================

    [Fact]
    public async Task Login_WithValidCredentials_ShouldReturn200AndStoreMfaCodeInDatabase()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        // Act
        var response = await _client.PostAsJsonAsync(
            Endpoints.Auth.Login,
            LoginRequest(user.Email!, TestConstants.Users.DefaultPassword));

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // MFA-kode er lagret i databasen — eposttjenesten er mocka, koden leses herfra
        var mfaCode = await _factory.QueryAsync(async db =>
            (await db.VerificationInfos
                .AsNoTracking()
                .FirstAsync(vi => vi.UserId == user.Id))
            .LoginMfaCode);

        mfaCode.Should().MatchRegex(@"^\d{6}$");
    }

    // ======================== 401 Unauthorized ========================

    [Fact]
    public async Task Login_WithWrongPassword_ShouldReturn401WithInvalidCredentials()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        // Act
        var response = await _client.PostAsJsonAsync(
            Endpoints.Auth.Login,
            LoginRequest(user.Email!, "FeilPassord123!"));

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.InvalidCredentials);
    }

    [Fact]
    public async Task Login_WithUnknownEmail_ShouldReturn401WithInvalidCredentials()
    {
        // Arrange — ingen bruker seedes; timing-beskyttelse (DummyUser) gir samme responstid
        // Act
        var response = await _client.PostAsJsonAsync(
            Endpoints.Auth.Login,
            LoginRequest("finnesikke@test.no", TestConstants.Users.DefaultPassword));

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.InvalidCredentials);
    }

    [Fact]
    public async Task Login_WhenEmailNotConfirmed_ShouldReturn401WithEmailNotConfirmed()
    {
        // Arrange
        var user = new UserBuilder().AsEmailUnverified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        // Act
        var response = await _client.PostAsJsonAsync(
            Endpoints.Auth.Login,
            LoginRequest(user.Email!, TestConstants.Users.DefaultPassword));

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.EmailNotConfirmed);
    }

    [Fact]
    public async Task Login_WhenPhoneNotConfirmed_ShouldReturn401WithPhoneNotConfirmed()
    {
        // Arrange
        var user = new UserBuilder().AsPhoneUnverified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        // Act
        var response = await _client.PostAsJsonAsync(
            Endpoints.Auth.Login,
            LoginRequest(user.Email!, TestConstants.Users.DefaultPassword));

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.PhoneNotConfirmed);
    }

    // ======================== 403 Forbidden ========================

    [Fact]
    public async Task Login_WhenAccountLocked_ShouldReturn403WithAccountLocked()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        // Sett kontoen som låst direkte via databasen
        await _factory.SeedAsync(async db =>
        {
            var u = await db.AppUsers.FindAsync(user.Id);
            u!.LockoutEnabled = true;
            u.LockoutEnd = DateTimeOffset.UtcNow.AddMinutes(5);
            await db.SaveChangesAsync();
        });

        // Act
        var response = await _client.PostAsJsonAsync(
            Endpoints.Auth.Login,
            LoginRequest(user.Email!, TestConstants.Users.DefaultPassword));

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.AccountLocked);
    }

    // ======================== 403 Forbidden — autolåsing etter feil passord ========================

    [Fact]
    public async Task Login_AfterFiveWrongPasswordAttempts_ShouldLockAccountAndReturn403()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        // 5 feil passord-forsøk trigger Identity-lockout (MaxFailedAccessAttempts = 5).
        // Hvert forsøk returnerer 401 — låsingen skjer inne i AccessFailedAsync etter 5. forsøk.
        for (var i = 0; i < 5; i++)
        {
            await _client.PostAsJsonAsync(
                Endpoints.Auth.Login,
                LoginRequest(user.Email!, "FeilPassord123!"));
        }

        // Act — riktig passord, men konto er nå låst
        var response = await _client.PostAsJsonAsync(
            Endpoints.Auth.Login,
            LoginRequest(user.Email!, TestConstants.Users.DefaultPassword));

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.AccountLocked);
    }

    // ======================== 500 Internal Server Error — MFA-epost feiler ========================

    [Fact]
    public async Task Login_WhenMfaEmailFails_ShouldReturn500WithInternalError()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        // Overstyr e-post-tjenesten til å returnere feil kun for denne testen.
        // WithWebHostBuilder arver containers + konfigurasjon fra den delte fabrikken.
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
            "User-Agent", "Mozilla/5.0 Chrome/99998.0 EmailFailTest");

        // Act
        var response = await client.PostAsJsonAsync(
            Endpoints.Auth.Login,
            LoginRequest(user.Email!, TestConstants.Users.DefaultPassword));

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.InternalServerError);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.InternalError);
    }

    // ======================== Hjelpemetode ========================

    private static LoginRequest LoginRequest(string email, string password) => new()
    {
        Email    = email,
        Password = password,
        Device   = new DeviceInfoRequest
        {
            DeviceFingerprint = Guid.NewGuid().ToString(),
            DeviceName        = TestConstants.Devices.DefaultDeviceName,
            DeviceType        = DeviceType.Unknown,
            OperatingSystem   = OperatingSystemType.Unknown,
        },
    };
}
