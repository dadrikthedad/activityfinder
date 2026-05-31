using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Features.Auth.DTOs.Request;
using AFBack.Features.Auth.DTOs.Response;
using AFBack.Tests.Builders;
using AFBack.Tests.Common;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Tests.Features.Auth;

/// <summary>
/// Integrasjonstester for SignupAsync.
/// Dekker happy path, sideeffekter (bruker/profil/innstillinger opprettes),
/// duplikat epost og telefon, og modelvalidering.
/// </summary>
[Collection(nameof(IntegrationTestsCollection))]
public class AuthSignupIntegrationTests : IAsyncLifetime
{
    private readonly BackendApplicationFactory _factory;
    private readonly HttpClient                _client;

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public AuthSignupIntegrationTests(BackendApplicationFactory factory)
    {
        _factory = factory;
        _client  = factory.CreateClient();
    }

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync()
    {
        await _factory.ResetDatabaseAsync();
        await _factory.ResetRedisAsync();
    }

    // ======================== Hjelpemetoder ========================

    /// <summary>
    /// Gyldig registreringsforespørsel med unike verdier.
    /// Overstyr kun feltene som er relevante for scenariet som testes.
    /// </summary>
    private static SignupRequest ValidRequest(string? email = null, string? phone = null) => new()
    {
        Email       = email ?? $"test-{Guid.NewGuid():N}@test.no",
        Password    = TestConstants.Users.DefaultPassword,
        FirstName   = TestConstants.Users.DefaultFirstName,
        LastName    = TestConstants.Users.DefaultLastName,
        PhoneNumber = phone ?? $"+479{Random.Shared.Next(1000000, 9999999)}",
        DateOfBirth = TestConstants.Profiles.DefaultDateOfBirth,
        CountryCode = TestConstants.Profiles.DefaultCountryCode,
    };

    // ======================== Happy path ========================

    [Fact]
    public async Task Signup_WithValidRequest_ShouldReturn201WithUserId()
    {
        var request = ValidRequest();

        var response = await _client.PostAsJsonAsync(Endpoints.Auth.Signup, request);
        var body     = await response.Content.ReadFromJsonAsync<SignupResponse>(JsonOpts);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        body!.UserId.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task Signup_WithValidRequest_ShouldReturnEmailSentTrue()
    {
        var request = ValidRequest();

        var response = await _client.PostAsJsonAsync(Endpoints.Auth.Signup, request);
        var body     = await response.Content.ReadFromJsonAsync<SignupResponse>(JsonOpts);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        body!.EmailSent.Should().BeTrue(
            "verifiseringsepost skal sendes ved signup — eposttjenesten er mocka til aa returnere suksess");
    }

    // ======================== Sideeffekter ========================

    [Fact]
    public async Task Signup_ShouldCreateUserWithUnverifiedEmail()
    {
        var request = ValidRequest();

        var response = await _client.PostAsJsonAsync(Endpoints.Auth.Signup, request);
        var body     = await response.Content.ReadFromJsonAsync<SignupResponse>(JsonOpts);

        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var user = await _factory.QueryAsync(async db =>
            await db.AppUsers.AsNoTracking().FirstAsync(u => u.Id == body!.UserId));

        user.EmailConfirmed.Should().BeFalse(
            "ny bruker ma bekrefte eposten sin for kontoen er aktiv");
    }

    [Fact]
    public async Task Signup_ShouldCreateUserWithUnverifiedPhone()
    {
        var request = ValidRequest();

        var response = await _client.PostAsJsonAsync(Endpoints.Auth.Signup, request);
        var body     = await response.Content.ReadFromJsonAsync<SignupResponse>(JsonOpts);

        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var user = await _factory.QueryAsync(async db =>
            await db.AppUsers.AsNoTracking().FirstAsync(u => u.Id == body!.UserId));

        user.PhoneNumberConfirmed.Should().BeFalse(
            "ny bruker ma ogsa bekrefte telefonnummeret sitt (steg 2 i verifiseringsflyten)");
    }

    [Fact]
    public async Task Signup_ShouldSetFullNameFromFirstAndLastName()
    {
        var request = ValidRequest();

        var response = await _client.PostAsJsonAsync(Endpoints.Auth.Signup, request);
        var body     = await response.Content.ReadFromJsonAsync<SignupResponse>(JsonOpts);

        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var user = await _factory.QueryAsync(async db =>
            await db.AppUsers.AsNoTracking().FirstAsync(u => u.Id == body!.UserId));

        user.FullName.Should().Be($"{request.FirstName} {request.LastName}");
    }

    [Fact]
    public async Task Signup_ShouldCreateVerificationInfoWithEmailCode()
    {
        var request = ValidRequest();

        var response = await _client.PostAsJsonAsync(Endpoints.Auth.Signup, request);
        var body     = await response.Content.ReadFromJsonAsync<SignupResponse>(JsonOpts);

        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var vi = await _factory.QueryAsync(async db =>
            await db.VerificationInfos.AsNoTracking()
                    .FirstOrDefaultAsync(vi => vi.UserId == body!.UserId));

        vi.Should().NotBeNull("VerificationInfo ma opprettes ved signup");
        vi!.EmailConfirmationCode.Should().NotBeNullOrWhiteSpace(
            "verifiseringskode ma vaere generert og klar til sending");
        vi.EmailCodeExpiresAt.Should().NotBeNull();
        vi.EmailCodeExpiresAt.Should().BeAfter(DateTime.UtcNow);
    }

    [Fact]
    public async Task Signup_ShouldCreateUserProfileWithCorrectData()
    {
        var request = ValidRequest();

        var response = await _client.PostAsJsonAsync(Endpoints.Auth.Signup, request);
        var body     = await response.Content.ReadFromJsonAsync<SignupResponse>(JsonOpts);

        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var profile = await _factory.QueryAsync(async db =>
            await db.Profiles.AsNoTracking()
                    .FirstOrDefaultAsync(p => p.UserId == body!.UserId));

        profile.Should().NotBeNull();
        profile!.CountryCode.Should().Be(request.CountryCode);
        profile.DateOfBirth.Should().Be(request.DateOfBirth);
    }

    [Fact]
    public async Task Signup_ShouldCreateUserSettingsWithLanguageMappedFromCountry()
    {
        var request = ValidRequest();

        var response = await _client.PostAsJsonAsync(Endpoints.Auth.Signup, request);
        var body     = await response.Content.ReadFromJsonAsync<SignupResponse>(JsonOpts);

        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var settings = await _factory.QueryAsync(async db =>
            await db.UserSettings.AsNoTracking()
                    .FirstOrDefaultAsync(s => s.UserId == body!.UserId));

        settings.Should().NotBeNull();
        // CountryCode "NO" → LanguageMapper → "nb" (norsk bokmål)
        settings!.Language.Should().Be("nb");
    }

    [Fact]
    public async Task Signup_ShouldAssignUserRole()
    {
        var request = ValidRequest();

        var response = await _client.PostAsJsonAsync(Endpoints.Auth.Signup, request);
        var body     = await response.Content.ReadFromJsonAsync<SignupResponse>(JsonOpts);

        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var hasUserRole = await _factory.QueryAsync(async db =>
        {
            var userRoleId = await db.Roles.AsNoTracking()
                                     .Where(r => r.Name == "User")
                                     .Select(r => r.Id)
                                     .FirstAsync();

            return await db.UserRoles.AsNoTracking()
                           .AnyAsync(ur => ur.UserId == body!.UserId && ur.RoleId == userRoleId);
        });

        hasUserRole.Should().BeTrue("alle nye brukere skal fa rollen 'User'");
    }

    // ======================== Duplikat epost og telefon ========================

    [Fact]
    public async Task Signup_WithExistingEmail_ShouldReturn409WithEmailAlreadyExists()
    {
        var existingUser = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(existingUser, TestConstants.Users.DefaultPassword);

        // Bruker eksisterende epost, men nytt telefonnummer
        var request = ValidRequest(email: existingUser.Email);

        var response = await _client.PostAsJsonAsync(Endpoints.Auth.Signup, request);
        var problem  = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        problem!.Code.Should().Be((int)AppErrorCode.EmailAlreadyExists);
    }

    [Fact]
    public async Task Signup_WithExistingPhone_ShouldReturn409WithPhoneNumberAlreadyExists()
    {
        var existingUser = new UserBuilder()
            .WithPhoneNumber("+4799887766")
            .AsVerified()
            .Build();
        await _factory.SeedUserWithManagerAsync(existingUser, TestConstants.Users.DefaultPassword);

        // Bruker nytt telefonnummer, men eksisterende telefon
        var request = ValidRequest(phone: "+4799887766");

        var response = await _client.PostAsJsonAsync(Endpoints.Auth.Signup, request);
        var problem  = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        problem!.Code.Should().Be((int)AppErrorCode.PhoneNumberAlreadyExists);
    }

    // ======================== Modelvalidering ========================

    [Fact]
    public async Task Signup_WithInvalidEmail_ShouldReturn400()
    {
        var request = ValidRequest(email: "dette-er-ikke-en-epost");

        var response = await _client.PostAsJsonAsync(Endpoints.Auth.Signup, request);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Signup_WithTooShortPassword_ShouldReturn400()
    {
        var request = new SignupRequest
        {
            Email       = $"test-{Guid.NewGuid():N}@test.no",
            Password    = "Abc1!",   // 5 tegn — under [MinLength(8)]
            FirstName   = TestConstants.Users.DefaultFirstName,
            LastName    = TestConstants.Users.DefaultLastName,
            PhoneNumber = $"+479{Random.Shared.Next(1000000, 9999999)}",
            DateOfBirth = TestConstants.Profiles.DefaultDateOfBirth,
            CountryCode = TestConstants.Profiles.DefaultCountryCode,
        };

        var response = await _client.PostAsJsonAsync(Endpoints.Auth.Signup, request);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Signup_WithUnder18DateOfBirth_ShouldReturn400()
    {
        // 10 ar gammel — klart under aldersgrensen pa 18
        var under18 = DateOnly.FromDateTime(DateTime.UtcNow).AddYears(-10);

        var request = new SignupRequest
        {
            Email       = $"test-{Guid.NewGuid():N}@test.no",
            Password    = TestConstants.Users.DefaultPassword,
            FirstName   = TestConstants.Users.DefaultFirstName,
            LastName    = TestConstants.Users.DefaultLastName,
            PhoneNumber = $"+479{Random.Shared.Next(1000000, 9999999)}",
            DateOfBirth = under18,
            CountryCode = TestConstants.Profiles.DefaultCountryCode,
        };

        var response = await _client.PostAsJsonAsync(Endpoints.Auth.Signup, request);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Signup_WithPasswordMissingRequiredComplexity_ShouldReturn422()
    {
        // Passerer [MinLength(8)] men mangler stor bokstav — feiler Identity-validering
        var request = new SignupRequest
        {
            Email       = $"test-{Guid.NewGuid():N}@test.no",
            Password    = "alllower1!",
            FirstName   = TestConstants.Users.DefaultFirstName,
            LastName    = TestConstants.Users.DefaultLastName,
            PhoneNumber = $"+479{Random.Shared.Next(1000000, 9999999)}",
            DateOfBirth = TestConstants.Profiles.DefaultDateOfBirth,
            CountryCode = TestConstants.Profiles.DefaultCountryCode,
        };

        var response = await _client.PostAsJsonAsync(Endpoints.Auth.Signup, request);
        var problem  = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        problem!.Code.Should().Be((int)AppErrorCode.InvalidRegistrationData);
    }
}
