using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Features.Auth.DTOs.Request;
using AFBack.Tests.Builders;
using AFBack.Tests.Common;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Tests.Features.Auth;

/// <summary>
/// Integrasjonstester for VerificationController.
/// Dekker verifisering av epost og telefon etter signup,
/// samt resending av koder for begge kanaler.
/// </summary>
[Collection(nameof(IntegrationTestsCollection))]
public class AuthVerificationTests : IAsyncLifetime
{
    private readonly BackendApplicationFactory _factory;
    private readonly HttpClient                _client;

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public AuthVerificationTests(BackendApplicationFactory factory)
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
    /// Seeder en bruker med ubekreftet epost og setter en kjent kode direkte i DB.
    /// Unngaar avhengighet til resend-endepunktet i VerifyEmail-tester.
    /// </summary>
    private async Task<(string Email, string UserId, string Code)> SeedEmailUnverifiedWithCodeAsync()
    {
        const string code = "123456";
        var user = new UserBuilder().AsEmailUnverified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        await _factory.SeedAsync(async db =>
        {
            var vi = await db.VerificationInfos.FirstAsync(v => v.UserId == user.Id);
            vi.EmailConfirmationCode = code;
            vi.EmailCodeExpiresAt    = DateTime.UtcNow.AddMinutes(10);
            await db.SaveChangesAsync();
        });

        return (user.Email!, user.Id, code);
    }

    /// <summary>
    /// Seeder en bruker med bekreftet epost men ubekreftet telefon,
    /// og setter en kjent kode direkte i DB.
    /// Unngaar avhengighet til resend-endepunktet i VerifyPhone-tester.
    /// </summary>
    private async Task<(string Email, string UserId, string Code)> SeedPhoneUnverifiedWithCodeAsync()
    {
        const string code = "654321";
        var user = new UserBuilder().AsPhoneUnverified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        await _factory.SeedAsync(async db =>
        {
            var vi = await db.VerificationInfos.FirstAsync(v => v.UserId == user.Id);
            vi.PhoneVerificationCode = code;
            vi.PhoneCodeExpiresAt    = DateTime.UtcNow.AddMinutes(10);
            await db.SaveChangesAsync();
        });

        return (user.Email!, user.Id, code);
    }

    // ======================== Verifiser epost — happy path ========================

    [Fact]
    public async Task VerifyEmail_WithValidCode_ShouldReturn200()
    {
        var (email, _, code) = await SeedEmailUnverifiedWithCodeAsync();

        var response = await _client.PostAsJsonAsync(
            Endpoints.Verification.VerifyEmail,
            new VerifyEmailRequest { Email = email, Code = code });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task VerifyEmail_WithValidCode_ShouldSetEmailConfirmedTrue()
    {
        var (email, userId, code) = await SeedEmailUnverifiedWithCodeAsync();

        await _client.PostAsJsonAsync(
            Endpoints.Verification.VerifyEmail,
            new VerifyEmailRequest { Email = email, Code = code });

        var user = await _factory.QueryAsync(async db =>
            await db.AppUsers.AsNoTracking().FirstAsync(u => u.Id == userId));

        user.EmailConfirmed.Should().BeTrue("riktig kode skal sette EmailConfirmed = true");
    }

    [Fact]
    public async Task VerifyEmail_WithValidCode_ShouldClearCodeFromDatabase()
    {
        var (email, userId, code) = await SeedEmailUnverifiedWithCodeAsync();

        await _client.PostAsJsonAsync(
            Endpoints.Verification.VerifyEmail,
            new VerifyEmailRequest { Email = email, Code = code });

        var vi = await _factory.QueryAsync(async db =>
            await db.VerificationInfos.AsNoTracking().FirstAsync(v => v.UserId == userId));

        vi.EmailConfirmationCode.Should().BeNull("brukt kode skal nullstilles i DB (engangsbruk)");
        vi.EmailCodeExpiresAt.Should().BeNull();
    }

    // ======================== Verifiser epost — feilscenarioer ========================

    [Fact]
    public async Task VerifyEmail_WithWrongCode_ShouldReturn422WithInvalidCode()
    {
        var (email, _, _) = await SeedEmailUnverifiedWithCodeAsync();

        var response = await _client.PostAsJsonAsync(
            Endpoints.Verification.VerifyEmail,
            new VerifyEmailRequest { Email = email, Code = "000000" });

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        problem!.Code.Should().Be((int)AppErrorCode.InvalidCode);
    }

    [Fact]
    public async Task VerifyEmail_WithAlreadyVerifiedEmail_ShouldReturn409()
    {
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        var response = await _client.PostAsJsonAsync(
            Endpoints.Verification.VerifyEmail,
            new VerifyEmailRequest { Email = user.Email!, Code = "123456" });

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        problem!.Code.Should().Be((int)AppErrorCode.Conflict);
    }

    [Fact]
    public async Task VerifyEmail_WithUnknownEmail_ShouldReturn401()
    {
        var response = await _client.PostAsJsonAsync(
            Endpoints.Verification.VerifyEmail,
            new VerifyEmailRequest { Email = "finnesikke@test.no", Code = "123456" });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ======================== Send ny epost-kode ========================

    [Fact]
    public async Task ResendVerification_ForUnverifiedEmail_ShouldReturn200AndSetNewCode()
    {
        var user = new UserBuilder().AsEmailUnverified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        var response = await _client.PostAsJsonAsync(
            Endpoints.Verification.ResendEmail,
            new EmailRequest { Email = user.Email! });

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var vi = await _factory.QueryAsync(async db =>
            await db.VerificationInfos.AsNoTracking().FirstAsync(v => v.UserId == user.Id));

        vi.EmailConfirmationCode.Should().NotBeNullOrWhiteSpace(
            "resend skal generere og lagre en ny verifiseringskode");
        vi.EmailCodeExpiresAt.Should().BeAfter(DateTime.UtcNow);
    }

    [Fact]
    public async Task ResendVerification_WithUnknownEmail_ShouldReturn200()
    {
        // Returnerer alltid 200 for aa forhindre email enumeration — avslorer ikke om eposten finnes
        var response = await _client.PostAsJsonAsync(
            Endpoints.Verification.ResendEmail,
            new EmailRequest { Email = "finnesikke@test.no" });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task ResendVerification_WithAlreadyVerifiedEmail_ShouldReturn200()
    {
        // Returnerer 200 uten aa sende epost — stille no-op for allerede verifiserte brukere
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        var response = await _client.PostAsJsonAsync(
            Endpoints.Verification.ResendEmail,
            new EmailRequest { Email = user.Email! });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // ======================== Verifiser telefon — happy path ========================

    [Fact]
    public async Task VerifyPhone_WithValidCode_ShouldReturn200()
    {
        var (email, _, code) = await SeedPhoneUnverifiedWithCodeAsync();

        var response = await _client.PostAsJsonAsync(
            Endpoints.Verification.VerifyPhone,
            new VerifyEmailRequest { Email = email, Code = code });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task VerifyPhone_WithValidCode_ShouldSetPhoneNumberConfirmedTrue()
    {
        var (email, userId, code) = await SeedPhoneUnverifiedWithCodeAsync();

        await _client.PostAsJsonAsync(
            Endpoints.Verification.VerifyPhone,
            new VerifyEmailRequest { Email = email, Code = code });

        var user = await _factory.QueryAsync(async db =>
            await db.AppUsers.AsNoTracking().FirstAsync(u => u.Id == userId));

        user.PhoneNumberConfirmed.Should().BeTrue("riktig kode skal sette PhoneNumberConfirmed = true");
    }

    [Fact]
    public async Task VerifyPhone_WithValidCode_ShouldClearCodeFromDatabase()
    {
        var (email, userId, code) = await SeedPhoneUnverifiedWithCodeAsync();

        await _client.PostAsJsonAsync(
            Endpoints.Verification.VerifyPhone,
            new VerifyEmailRequest { Email = email, Code = code });

        var vi = await _factory.QueryAsync(async db =>
            await db.VerificationInfos.AsNoTracking().FirstAsync(v => v.UserId == userId));

        vi.PhoneVerificationCode.Should().BeNull("brukt kode skal nullstilles i DB (engangsbruk)");
        vi.PhoneCodeExpiresAt.Should().BeNull();
    }

    // ======================== Verifiser telefon — feilscenarioer ========================

    [Fact]
    public async Task VerifyPhone_WithWrongCode_ShouldReturn422WithInvalidCode()
    {
        var (email, _, _) = await SeedPhoneUnverifiedWithCodeAsync();

        var response = await _client.PostAsJsonAsync(
            Endpoints.Verification.VerifyPhone,
            new VerifyEmailRequest { Email = email, Code = "000000" });

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        problem!.Code.Should().Be((int)AppErrorCode.InvalidCode);
    }

    [Fact]
    public async Task VerifyPhone_WithAlreadyVerifiedPhone_ShouldReturn409()
    {
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        var response = await _client.PostAsJsonAsync(
            Endpoints.Verification.VerifyPhone,
            new VerifyEmailRequest { Email = user.Email!, Code = "654321" });

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        problem!.Code.Should().Be((int)AppErrorCode.Conflict);
    }

    [Fact]
    public async Task VerifyPhone_WithUnknownEmail_ShouldReturn401()
    {
        var response = await _client.PostAsJsonAsync(
            Endpoints.Verification.VerifyPhone,
            new VerifyEmailRequest { Email = "finnesikke@test.no", Code = "654321" });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ======================== Send ny SMS-kode ========================

    [Fact]
    public async Task ResendPhoneVerification_ForUnverifiedPhone_ShouldReturn200AndSetNewCode()
    {
        var user = new UserBuilder().AsPhoneUnverified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        var response = await _client.PostAsJsonAsync(
            Endpoints.Verification.ResendPhone,
            new EmailRequest { Email = user.Email! });

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var vi = await _factory.QueryAsync(async db =>
            await db.VerificationInfos.AsNoTracking().FirstAsync(v => v.UserId == user.Id));

        vi.PhoneVerificationCode.Should().NotBeNullOrWhiteSpace(
            "resend skal generere og lagre en ny SMS-kode");
        vi.PhoneCodeExpiresAt.Should().BeAfter(DateTime.UtcNow);
    }

    [Fact]
    public async Task ResendPhoneVerification_WithUnknownEmail_ShouldReturn200()
    {
        // Returnerer alltid 200 for aa forhindre phone enumeration — avslorer ikke om brukeren finnes
        var response = await _client.PostAsJsonAsync(
            Endpoints.Verification.ResendPhone,
            new EmailRequest { Email = "finnesikke@test.no" });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task ResendPhoneVerification_WithAlreadyVerifiedPhone_ShouldReturn200()
    {
        // Returnerer 200 uten aa sende SMS — stille no-op for allerede verifiserte brukere
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        var response = await _client.PostAsJsonAsync(
            Endpoints.Verification.ResendPhone,
            new EmailRequest { Email = user.Email! });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
