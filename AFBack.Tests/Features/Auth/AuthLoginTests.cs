using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Features.Auth.DTOs.Request;
using AFBack.Features.Auth.DTOs.Response;
using AFBack.Features.Auth.Enums;
using AFBack.Tests.Builders;
using AFBack.Tests.Common;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Tests.Features.Auth;

/// <summary>
/// Integrasjonstester for innloggingsflyten:
///   Steg 1 — POST /api/auth/login       (validerer passord, sender MFA-kode på epost)
///   Steg 2 — POST /api/auth/login/verify-mfa (validerer MFA-kode, returnerer tokens)
///
/// Eposttjenesten er mocka, så MFA-koden leses direkte fra databasen etter steg 1.
/// Alle tester nullstiller databasen og Redis i DisposeAsync for å sikre isolasjon.
/// </summary>
[Collection(nameof(IntegrationTestsCollection))]
public class AuthLoginTests : IAsyncLifetime
{
    private readonly BackendApplicationFactory _factory;
    private readonly HttpClient                _client;

    // System.Text.Json med Web-standarder (case-insensitive, camelCase)
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public AuthLoginTests(BackendApplicationFactory factory)
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

    private static DeviceInfoRequest DefaultDevice(string? fingerprint = null) => new()
    {
        DeviceFingerprint = fingerprint ?? Guid.NewGuid().ToString(),
        DeviceName        = "Integration Test Device",
        DeviceType        = DeviceType.Unknown,
        OperatingSystem   = OperatingSystemType.Unknown,
    };

    /// <summary>
    /// Oppretter en ferdig verifisert testbruker (epost + telefon bekreftet).
    /// </summary>
    private async Task<(string Email, string Password, string UserId)> SeedVerifiedUserAsync()
    {
        const string password = "TestPass123!";
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, password);
        return (user.Email!, password, user.Id);
    }

    /// <summary>
    /// Oppretter en bruker der eposten ikke er bekreftet.
    /// </summary>
    private async Task<(string Email, string Password)> SeedEmailUnverifiedUserAsync()
    {
        const string password = "TestPass123!";
        var user = new UserBuilder().AsEmailUnverified().Build();
        await _factory.SeedUserWithManagerAsync(user, password);
        return (user.Email!, password);
    }

    /// <summary>
    /// Oppretter en bruker der telefonnummeret ikke er bekreftet.
    /// </summary>
    private async Task<(string Email, string Password)> SeedPhoneUnverifiedUserAsync()
    {
        const string password = "TestPass123!";
        var user = new UserBuilder().AsPhoneUnverified().Build();
        await _factory.SeedUserWithManagerAsync(user, password);
        return (user.Email!, password);
    }

    /// <summary>
    /// Fullforer hele innloggingsflyten (steg 1 + MFA) og returnerer LoginResponse med tokens.
    /// Krever at bruker er seeda med SeedUserWithManagerAsync for.
    /// </summary>
    private async Task<LoginResponse> PerformFullLoginAsync(
        string email, string password, string fingerprint)
    {
        // Steg 1: Send innloggingsforespørsel — backend sender MFA-kode på epost (mocka)
        var loginReq = new LoginRequest
        {
            Email    = email,
            Password = password,
            Device   = DefaultDevice(fingerprint),
        };
        var step1 = await _client.PostAsJsonAsync(Endpoints.Auth.Login, loginReq);
        step1.StatusCode.Should().Be(HttpStatusCode.OK, "steg 1 skal gi 200 OK");

        // Les MFA-koden direkte fra databasen siden eposttjenesten er mocka
        var mfaCode = await _factory.QueryAsync(async db =>
        {
            var user = await db.AppUsers.AsNoTracking()
                               .FirstAsync(u => u.Email == email);
            var vi = await db.VerificationInfos.AsNoTracking()
                             .FirstAsync(vi => vi.UserId == user.Id);
            return vi.LoginMfaCode!;
        });

        // Steg 2: Verifiser MFA-kode og hent tokens
        var mfaReq = new VerifyMfaRequest
        {
            Email  = email,
            Code   = mfaCode,
            Device = DefaultDevice(fingerprint),
        };
        var step2 = await _client.PostAsJsonAsync(Endpoints.Auth.LoginVerifyMfa, mfaReq);
        step2.StatusCode.Should().Be(HttpStatusCode.OK, "steg 2 skal gi 200 OK");

        return (await step2.Content.ReadFromJsonAsync<LoginResponse>(JsonOpts))!;
    }

    // ======================== Login steg 1 ========================

    [Fact]
    public async Task Login_WithValidCredentials_ShouldReturn200()
    {
        var (email, password, _) = await SeedVerifiedUserAsync();
        var request = new LoginRequest
        {
            Email    = email,
            Password = password,
            Device   = DefaultDevice(),
        };

        var response = await _client.PostAsJsonAsync(Endpoints.Auth.Login, request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Login_WithWrongPassword_ShouldReturn401WithInvalidCredentials()
    {
        var (email, _, _) = await SeedVerifiedUserAsync();
        var request = new LoginRequest
        {
            Email    = email,
            Password = "GaltPassord123!",
            Device   = DefaultDevice(),
        };

        var response = await _client.PostAsJsonAsync(Endpoints.Auth.Login, request);
        var problem  = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        problem!.Code.Should().Be((int)AppErrorCode.InvalidCredentials);
    }

    [Fact]
    public async Task Login_WithUnknownEmail_ShouldReturn401WithInvalidCredentials()
    {
        var request = new LoginRequest
        {
            Email    = "finnesikke@test.no",
            Password = "HvasomHelst123!",
            Device   = DefaultDevice(),
        };

        var response = await _client.PostAsJsonAsync(Endpoints.Auth.Login, request);
        var problem  = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        problem!.Code.Should().Be((int)AppErrorCode.InvalidCredentials);
    }

    [Fact]
    public async Task Login_WithUnverifiedEmail_ShouldReturn401WithEmailNotConfirmed()
    {
        var (email, password) = await SeedEmailUnverifiedUserAsync();
        var request = new LoginRequest
        {
            Email    = email,
            Password = password,
            Device   = DefaultDevice(),
        };

        var response = await _client.PostAsJsonAsync(Endpoints.Auth.Login, request);
        var problem  = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        problem!.Code.Should().Be((int)AppErrorCode.EmailNotConfirmed);
    }

    [Fact]
    public async Task Login_WithUnverifiedPhone_ShouldReturn401WithPhoneNotConfirmed()
    {
        var (email, password) = await SeedPhoneUnverifiedUserAsync();
        var request = new LoginRequest
        {
            Email    = email,
            Password = password,
            Device   = DefaultDevice(),
        };

        var response = await _client.PostAsJsonAsync(Endpoints.Auth.Login, request);
        var problem  = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        problem!.Code.Should().Be((int)AppErrorCode.PhoneNotConfirmed);
    }

    [Fact]
    public async Task Login_WithWrongPassword_FiveTimes_ShouldLockAccount()
    {
        var (email, _, _) = await SeedVerifiedUserAsync();
        var wrongRequest = new LoginRequest
        {
            Email    = email,
            Password = "GaltPassord123!",
            Device   = DefaultDevice(),
        };

        // 5 feilede forsøk — utløser lockout etter siste forsøk
        for (var i = 0; i < 5; i++)
            await _client.PostAsJsonAsync(Endpoints.Auth.Login, wrongRequest);

        // Neste forsøk skal gi AccountLocked
        var response = await _client.PostAsJsonAsync(Endpoints.Auth.Login, wrongRequest);
        var problem  = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        problem!.Code.Should().Be((int)AppErrorCode.AccountLocked);
    }

    // ======================== Full innloggingsflyt (steg 1 + MFA) ========================

    [Fact]
    public async Task Login_ThenVerifyMfa_ShouldReturnAccessAndRefreshTokens()
    {
        var (email, password, _) = await SeedVerifiedUserAsync();

        var login = await PerformFullLoginAsync(email, password, Guid.NewGuid().ToString());

        login.AccessToken.Should().NotBeNullOrWhiteSpace();
        login.RefreshToken.Should().NotBeNullOrWhiteSpace();
        login.AccessTokenExpires.Should().BeAfter(DateTime.UtcNow);
        login.User.Should().NotBeNull();
        login.User.Id.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task Login_ThenVerifyMfa_ShouldCreateUserDevice()
    {
        var (email, password, userId) = await SeedVerifiedUserAsync();
        var fingerprint = Guid.NewGuid().ToString();

        await PerformFullLoginAsync(email, password, fingerprint);

        var device = await _factory.QueryAsync(async db =>
            await db.UserDevices.AsNoTracking()
                    .FirstOrDefaultAsync(d => d.UserId == userId
                                           && d.DeviceFingerprint == fingerprint));

        device.Should().NotBeNull("innlogging skal opprette en UserDevice for enheten");
    }

    [Fact]
    public async Task Login_ThenVerifyMfa_TwiceWithSameFingerprint_ShouldReuseUserDevice()
    {
        var (email, password, userId) = await SeedVerifiedUserAsync();
        var fingerprint = Guid.NewGuid().ToString();

        await PerformFullLoginAsync(email, password, fingerprint);
        await PerformFullLoginAsync(email, password, fingerprint);

        var deviceCount = await _factory.QueryAsync(async db =>
            await db.UserDevices.AsNoTracking()
                    .CountAsync(d => d.UserId == userId
                                  && d.DeviceFingerprint == fingerprint));

        deviceCount.Should().Be(1, "samme fingerprint skal gjenbruke eksisterende enhet");
    }

    // ======================== Token-fornyelse ========================

    [Fact]
    public async Task RefreshToken_WithValidToken_ShouldReturnNewTokenPair()
    {
        var (email, password, _) = await SeedVerifiedUserAsync();
        var fingerprint = Guid.NewGuid().ToString();
        var login = await PerformFullLoginAsync(email, password, fingerprint);

        var request = new RefreshTokenRequest
        {
            DeviceFingerprint = fingerprint,
            RefreshToken      = login.RefreshToken,
        };

        var response = await _client.PostAsJsonAsync(Endpoints.Token.Refresh, request);
        var tokens   = await response.Content.ReadFromJsonAsync<TokenResponse>(JsonOpts);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        tokens!.AccessToken.Should().NotBeNullOrWhiteSpace();
        tokens.RefreshToken.Should().NotBeNullOrWhiteSpace();
        tokens.RefreshToken.Should().NotBe(login.RefreshToken,
            "refresh-token skal roteres ved fornyelse");
    }

    [Fact]
    public async Task RefreshToken_WithRevokedToken_ShouldRevokeAllAndReturn401()
    {
        var (email, password, userId) = await SeedVerifiedUserAsync();
        var fingerprint = Guid.NewGuid().ToString();
        var login = await PerformFullLoginAsync(email, password, fingerprint);

        // Revoker token direkte i DB — simulerer at token er stjålet og allerede brukt
        await _factory.SeedAsync(async db =>
        {
            var token = await db.RefreshTokens.FirstAsync(t => t.Token == login.RefreshToken);
            token.IsRevoked    = true;
            token.RevokedAt    = DateTime.UtcNow;
            token.RevokedReason = "Simulert gjenbruksangrep (test)";
            await db.SaveChangesAsync();
        });

        var request = new RefreshTokenRequest
        {
            DeviceFingerprint = fingerprint,
            RefreshToken      = login.RefreshToken,
        };

        var response = await _client.PostAsJsonAsync(Endpoints.Token.Refresh, request);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        // Alle refresh-tokens for brukeren skal nå være revokert (reuse detection)
        var activeTokenCount = await _factory.QueryAsync(async db =>
            await db.RefreshTokens.AsNoTracking()
                    .CountAsync(t => t.UserId == userId && !t.IsRevoked));

        activeTokenCount.Should().Be(0,
            "reuse detection skal revoker alle tokens for brukeren");
    }

    [Fact]
    public async Task RefreshToken_WithWrongFingerprint_ShouldReturn401()
    {
        var (email, password, _) = await SeedVerifiedUserAsync();
        var fingerprint = Guid.NewGuid().ToString();
        var login = await PerformFullLoginAsync(email, password, fingerprint);

        var request = new RefreshTokenRequest
        {
            DeviceFingerprint = "annen-enhet-fingerprint-ukjent",
            RefreshToken      = login.RefreshToken,
        };

        var response = await _client.PostAsJsonAsync(Endpoints.Token.Refresh, request);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ======================== Utlogging ========================

    [Fact]
    public async Task Logout_ShouldRevokeRefreshToken()
    {
        var (email, password, _) = await SeedVerifiedUserAsync();
        var fingerprint = Guid.NewGuid().ToString();
        var login = await PerformFullLoginAsync(email, password, fingerprint);

        var authClient = _factory.CreateClient();
        authClient.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", login.AccessToken);

        var response = await authClient.PostAsJsonAsync(
            Endpoints.Auth.Logout,
            new LogoutRequest { RefreshToken = login.RefreshToken });

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var isRevoked = await _factory.QueryAsync(async db =>
        {
            var token = await db.RefreshTokens.AsNoTracking()
                                .FirstAsync(t => t.Token == login.RefreshToken);
            return token.IsRevoked;
        });

        isRevoked.Should().BeTrue("refresh-token skal revokeres ved utlogging");
    }

    [Fact]
    public async Task Logout_ShouldBlacklistAccessToken_SoSubsequentRequestsReturn401()
    {
        var (email, password, _) = await SeedVerifiedUserAsync();
        var fingerprint = Guid.NewGuid().ToString();
        var login = await PerformFullLoginAsync(email, password, fingerprint);

        var authClient = _factory.CreateClient();
        authClient.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", login.AccessToken);

        // Logger ut — access token skal nå blacklistes i Redis
        await authClient.PostAsJsonAsync(
            Endpoints.Auth.Logout,
            new LogoutRequest { RefreshToken = login.RefreshToken });

        // Forsøk å bruke det blacklistede access tokenet på et autentisert endepunkt
        var response = await authClient.GetAsync(Endpoints.Settings.Get);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized,
            "blacklistet access token skal avvises");
    }

    [Fact]
    public async Task LogoutAll_ShouldRevokeAllRefreshTokensForUser()
    {
        var (email, password, userId) = await SeedVerifiedUserAsync();

        // Logg inn fra to forskjellige enheter
        var login1 = await PerformFullLoginAsync(email, password, Guid.NewGuid().ToString());
        var login2 = await PerformFullLoginAsync(email, password, Guid.NewGuid().ToString());

        // Logg ut fra alle enheter med enhet 1 sitt access token
        var authClient = _factory.CreateClient();
        authClient.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", login1.AccessToken);

        var response = await authClient.PostAsJsonAsync(Endpoints.Auth.LogoutAll, new { });

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Alle tokens for brukeren skal nå være revokert
        var activeTokenCount = await _factory.QueryAsync(async db =>
            await db.RefreshTokens.AsNoTracking()
                    .CountAsync(t => t.UserId == userId && !t.IsRevoked));

        activeTokenCount.Should().Be(0,
            "logout-all skal revoker alle refresh-tokens for brukeren");
    }
}
