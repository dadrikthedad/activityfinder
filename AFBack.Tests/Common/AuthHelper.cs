using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using AFBack.Features.Auth.DTOs.Request;
using AFBack.Features.Auth.DTOs.Response;
using AFBack.Features.Auth.Enums;
using AFBack.Tests.Builders;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Tests.Common;

/// <summary>
/// Tokens og fingerprint for én innlogget test-økt.
/// Brukes som argument til BuildRequest og for å forny/revoker tokens i tester.
/// </summary>
public record AuthSession(
    string AccessToken,
    string RefreshToken,
    string DeviceFingerprint);

/// <summary>
/// AuthSession utvidet med metadata om den seeda testbrukeren.
/// Returneres fra SeedAndLoginAsync for å gi testkoden alt den trenger i ett kall.
/// </summary>
public record UserAuthSession(AuthSession Session, string UserId, string Email)
{
    public string AccessToken       => Session.AccessToken;
    public string RefreshToken      => Session.RefreshToken;
    public string DeviceFingerprint => Session.DeviceFingerprint;
}

/// <summary>
/// Delte hjelpemetoder for autentiserte integrasjonstester: innloggingsflyt og request-bygging.
/// Gir en enkel måte å logge inn og lage autentiserte forespørsler på tvers av alle tester.
/// </summary>
public static class AuthHelper
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    // ======================== Innlogging ========================

    /// <summary>
    /// Fullforer den 2-stegs innloggingsflyten og returnerer en AuthSession med tokens.
    /// Eposttjenesten er mocka, så MFA-koden leses direkte fra databasen etter steg 1.
    /// </summary>
    /// <param name="client">HttpClient fra integrasjonstesten</param>
    /// <param name="factory">Factory brukes for å lese MFA-koden fra databasen</param>
    /// <param name="email">Epostadressen til brukeren som logges inn</param>
    /// <param name="password">Klartekstpassordet til brukeren</param>
    /// <param name="fingerprint">Enhetsidentifikator — genereres automatisk hvis ikke oppgitt</param>
    public static async Task<AuthSession> LoginAsync(
        HttpClient client,
        BackendApplicationFactory factory,
        string email,
        string password,
        string? fingerprint = null)
    {
        fingerprint ??= Guid.NewGuid().ToString();

        // Steg 1: valider passord — backend sender MFA-kode på epost (mocka)
        var step1 = await client.PostAsJsonAsync(Endpoints.Auth.Login, new LoginRequest
        {
            Email    = email,
            Password = password,
            Device   = MakeDevice(fingerprint),
        });
        step1.EnsureSuccessStatusCode();

        // Les MFA-koden direkte fra databasen
        var mfaCode = await factory.QueryAsync(async db =>
        {
            var user = await db.AppUsers.AsNoTracking()
                               .FirstAsync(u => u.Email == email);
            var vi   = await db.VerificationInfos.AsNoTracking()
                               .FirstAsync(vi => vi.UserId == user.Id);
            return vi.LoginMfaCode!;
        });

        // Steg 2: verifiser MFA-kode — returnerer tokens
        var step2 = await client.PostAsJsonAsync(Endpoints.Auth.LoginVerifyMfa, new VerifyMfaRequest
        {
            Email  = email,
            Code   = mfaCode,
            Device = MakeDevice(fingerprint),
        });
        step2.EnsureSuccessStatusCode();

        var login = (await step2.Content.ReadFromJsonAsync<LoginResponse>(JsonOpts))!;
        return new AuthSession(login.AccessToken, login.RefreshToken, fingerprint);
    }

    /// <summary>
    /// Oppretter en ferdig verifisert bruker og logger inn — alt i ett kall.
    /// Bruk dette som ett-linje Arrange-steg i tester som trenger en autentisert bruker.
    /// </summary>
    /// <param name="factory">Factory for seeding og DB-lesing</param>
    /// <param name="client">HttpClient fra integrasjonstesten</param>
    /// <param name="password">Passord for brukeren — standard er TestConstants.Users.DefaultPassword</param>
    public static async Task<UserAuthSession> SeedAndLoginAsync(
        BackendApplicationFactory factory,
        HttpClient client,
        string password = TestConstants.Users.DefaultPassword)
    {
        var user = new UserBuilder().AsVerified().Build();
        await factory.SeedUserWithManagerAsync(user, password);

        var session = await LoginAsync(client, factory, user.Email!, password);
        return new UserAuthSession(session, user.Id, user.Email!);
    }

    // ======================== Request-bygging ========================

    /// <summary>
    /// Setter auth-header på en forespørsel uten body. Bruk for GET og DELETE.
    /// authSession = null gir en uautentisert forespørsel (for 401-tester).
    /// </summary>
    public static HttpRequestMessage BuildRequest(
        HttpRequestMessage request,
        AuthSession? authSession = null)
        => AddAuth(request, authSession);

    /// <summary>
    /// Setter JSON-body og auth-header på en forespørsel. Bruk for POST, PUT og PATCH.
    /// authSession = null gir en uautentisert forespørsel (for 401-tester).
    /// </summary>
    public static HttpRequestMessage BuildRequest<T>(
        HttpRequestMessage request,
        T content,
        AuthSession? authSession = null)
    {
        request.Content = JsonContent.Create(content);
        return AddAuth(request, authSession);
    }

    // ======================== Privat ========================

    private static HttpRequestMessage AddAuth(HttpRequestMessage request, AuthSession? session)
    {
        if (session?.AccessToken is not null)
            request.Headers.Authorization =
                new AuthenticationHeaderValue("Bearer", session.AccessToken);
        return request;
    }

    private static DeviceInfoRequest MakeDevice(string fingerprint) => new()
    {
        DeviceFingerprint = fingerprint,
        DeviceName        = TestConstants.Devices.DefaultDeviceName,
        DeviceType        = DeviceType.Unknown,
        OperatingSystem   = OperatingSystemType.Unknown,
    };
}
