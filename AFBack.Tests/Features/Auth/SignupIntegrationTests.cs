using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Configurations.Options;
using AFBack.Features.Auth.DTOs.Request;
using AFBack.Features.Auth.DTOs.Response;
using AFBack.Infrastructure.Email.Enums;
using AFBack.Infrastructure.Security.Services;
using AFBack.Tests.Builders;
using AFBack.Tests.Common;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace AFBack.Tests.Features.Auth;

[Collection(nameof(IntegrationTestsCollection))]
public class SignupIntegrationTests : IAsyncLifetime
{
    private readonly BackendApplicationFactory _factory;
    private readonly HttpClient _client;

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    // Unik User-Agent per instans → unik fingerprint → egen rate-limit-bucket per test.
    // FingerprintUtils.GetWebFingerprint() bruker chrome/{versjon} som nøkkel.
    // Signup-tester bruker versjonsspenn 100–800; login-tester bruker 10100–10600+.
    private static int _testCounter;

    public SignupIntegrationTests(BackendApplicationFactory factory)
    {
        _factory = factory;
        var id = Interlocked.Increment(ref _testCounter);
        _client  = factory.CreateClientWithIp();
        _client.DefaultRequestHeaders.TryAddWithoutValidation(
            "User-Agent", $"Mozilla/5.0 Chrome/{id * 100}.0 SignupTest");
    }

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync()
    {
        await _factory.ResetDatabaseAsync();
        await _factory.ResetRedisAsync();
    }

    private static SignupRequest ValidRequest(string? email = null, string? phone = null) => new()
    {
        Email       = email   ?? $"ny-{Guid.NewGuid():N}@test.no",
        Password    = "TestPass123!",
        FirstName   = "Test",
        LastName    = "Bruker",
        PhoneNumber = phone   ?? $"+4799{Random.Shared.Next(100_000, 999_999)}",
        DateOfBirth = new DateOnly(1995, 6, 15),
        CountryCode = "NO",
    };

    private static SignupRequest RequestWith(
        string? email = null, string? phone = null, string? password = null,
        DateOnly? dateOfBirth = null) => new()
    {
        Email       = email       ?? $"ny-{Guid.NewGuid():N}@test.no",
        Password    = password    ?? "TestPass123!",
        FirstName   = "Test",
        LastName    = "Bruker",
        PhoneNumber = phone       ?? $"+4799{Random.Shared.Next(100_000, 999_999)}",
        DateOfBirth = dateOfBirth ?? new DateOnly(1995, 6, 15),
        CountryCode = "NO",
    };

    // ======================== 201 Created ========================

    [Fact]
    public async Task Signup_WithValidData_ShouldReturn201WithUserIdAndEmailSent()
    {
        // Arrange
        var request = ValidRequest();

        // Act
        var response = await _client.PostAsJsonAsync(Endpoints.Auth.Signup, request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var body = await response.Content.ReadFromJsonAsync<SignupResponse>(JsonOpts);
        body!.UserId.Should().NotBeNullOrEmpty();
        body.EmailSent.Should().BeTrue();
    }

    [Fact]
    public async Task Signup_WithValidData_ShouldPersistUserInDatabase()
    {
        // Arrange
        var request = ValidRequest();

        // Act
        await _client.PostAsJsonAsync(Endpoints.Auth.Signup, request);

        // Assert
        var userExists = await _factory.QueryAsync(async db =>
            await System.Threading.Tasks.Task.FromResult(
                db.AppUsers.Any(u => u.Email == request.Email)));

        userExists.Should().BeTrue();
    }

    // ======================== 400 Bad Request — modellvalidering ========================

    [Fact]
    public async Task Signup_WhenEmailMissing_ShouldReturn422WithValidationCode()
    {
        // Arrange
        var payload = new { Password = "TestPass123!", FirstName = "Test", LastName = "Bruker",
            PhoneNumber = "+4799123456", DateOfBirth = "1995-06-15", CountryCode = "NO" };

        // Act
        var response = await _client.PostAsJsonAsync(Endpoints.Auth.Signup, payload);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.Validation);
    }

    [Fact]
    public async Task Signup_WhenPasswordTooShort_ShouldReturn422WithInvalidRegistrationDataCode()
    {
        // Arrange — passord < 8 tegn: modellvalidering er undertrykket (SuppressModelStateInvalidFilter = true),
        // men Identity fanger kravet og returnerer 422 InvalidRegistrationData.
        var request = RequestWith(password: "short");

        // Act
        var response = await _client.PostAsJsonAsync(Endpoints.Auth.Signup, request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.InvalidRegistrationData);
    }

    [Fact]
    public async Task Signup_WhenInvalidEmailFormat_ShouldReturn422WithInvalidRegistrationDataCode()
    {
        // Arrange — ugyldig epostformat: SuppressModelStateInvalidFilter = true gjør at
        // [EmailAddress] ikke blokkerer requesten — Identity fanger det og returnerer 422.
        var request = RequestWith(email: "ikke-en-epost");

        // Act
        var response = await _client.PostAsJsonAsync(Endpoints.Auth.Signup, request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.InvalidRegistrationData);
    }

    // ======================== 409 Conflict — duplikat ========================

    [Fact]
    public async Task Signup_WhenEmailAlreadyRegistered_ShouldReturn409WithEmailAlreadyExistsCode()
    {
        // Arrange
        const string existingEmail = "allerede@test.no";
        var existingUser = new UserBuilder()
            .WithEmail(existingEmail)
            .AsVerified()
            .Build();

        await _factory.SeedUserWithManagerAsync(existingUser, "TestPass123!");

        var request = ValidRequest(email: existingEmail);

        // Act
        var response = await _client.PostAsJsonAsync(Endpoints.Auth.Signup, request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.EmailAlreadyExists);
    }

    [Fact]
    public async Task Signup_WhenPhoneAlreadyRegistered_ShouldReturn409WithPhoneNumberAlreadyExistsCode()
    {
        // Arrange
        const string existingPhone = "+4799000001";
        var existingUser = new UserBuilder()
            .WithPhoneNumber(existingPhone)
            .AsVerified()
            .Build();

        await _factory.SeedUserWithManagerAsync(existingUser, "TestPass123!");

        var request = ValidRequest(phone: existingPhone);

        // Act
        var response = await _client.PostAsJsonAsync(Endpoints.Auth.Signup, request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.PhoneNumberAlreadyExists);
    }

    // ======================== 429 Too Many Requests — rate limit ========================

    [Fact]
    public async Task Signup_WhenIpRateLimitExceeded_ShouldReturn429WithTooManyRequestsCode()
    {
        // Arrange — bruk en unik IP slik at denne testen ikke påvirker andre tester i samme kjøring.
        // EmailRateLimitService er en singleton som lever i minnet gjennom hele test-kjøringen.
        var uniqueIp = $"10.99.{Random.Shared.Next(1, 254)}.{Random.Shared.Next(1, 254)}";
        var rateLimitService = _factory.Services.GetRequiredService<IEmailRateLimitService>();

        for (var i = 0; i < EmailRateConfig.MaxEmailsPerIpPerHour; i++)
            rateLimitService.RegisterEmailSent(EmailType.Verification, $"fyll{i}@test.no", uniqueIp);

        var client = _factory.CreateClientWithIp(uniqueIp);
        client.DefaultRequestHeaders.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 Chrome/99999.0 RateLimitTest");

        // Act
        var response = await client.PostAsJsonAsync(Endpoints.Auth.Signup, ValidRequest());

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.TooManyRequests);
    }

    // ======================== 422 Unprocessable — Identity-validering ========================

    [Fact]
    public async Task Signup_WhenPasswordFailsIdentityRequirements_ShouldReturn422WithInvalidRegistrationDataCode()
    {
        // Arrange — passord møter modellvalidering (≥8 tegn) men mangler stor bokstav og siffer
        var request = RequestWith(password: "alllowercase!");

        // Act
        var response = await _client.PostAsJsonAsync(Endpoints.Auth.Signup, request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.InvalidRegistrationData);
    }
}
