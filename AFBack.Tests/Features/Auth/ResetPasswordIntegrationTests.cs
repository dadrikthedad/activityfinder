using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Features.Auth.DTOs.Request;
using AFBack.Features.Auth.Enums;
using AFBack.Tests.Builders;
using AFBack.Tests.Common;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Tests.Features.Auth;

[Collection(nameof(IntegrationTestsCollection))]
public class ResetPasswordIntegrationTests : IAsyncLifetime
{
    private readonly BackendApplicationFactory _factory;
    private readonly HttpClient _client;

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    // ResetPassword-tester bruker User-Agent-versjonsspenn 110100+ og IP-prefix 10.11.0.x.
    private static int _testCounter;

    public ResetPasswordIntegrationTests(BackendApplicationFactory factory)
    {
        _factory = factory;
        var id = Interlocked.Increment(ref _testCounter);
        _client = factory.CreateClientWithIp($"10.11.0.{id}");
        _client.DefaultRequestHeaders.TryAddWithoutValidation(
            "User-Agent", $"Mozilla/5.0 Chrome/{id * 100 + 110000}.0 ResetPasswordTest");
    }

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync()
    {
        await _factory.ResetDatabaseAsync();
        await _factory.ResetRedisAsync();
    }

    // ======================== Hjelpemetoder ========================

    /// <summary>
    /// Setter SmsPasswordResetVerified = true direkte i databasen.
    /// Simulerer at hele flyten (steg 1–3b) er fullført uten å kalle API-endepunktene
    /// og dermed uten å treffe rate-limiterne.
    /// </summary>
    private async Task SeedSmsVerifiedAsync(string email)
    {
        var userId = await _factory.QueryAsync(async db =>
            (await db.AppUsers.AsNoTracking().FirstAsync(u => u.Email == email)).Id);

        await _factory.SeedAsync(async db =>
        {
            var vi = await db.VerificationInfos.FirstAsync(v => v.UserId == userId);
            vi.EmailPasswordResetVerified  = true;
            vi.SmsPasswordResetVerified    = true;
            vi.SmsPasswordResetVerifiedAt  = DateTime.UtcNow;
            await db.SaveChangesAsync();
        });
    }

    // ======================== 200 OK — hele flyten ========================

    [Fact]
    public async Task ResetPassword_WithSmsVerified_ShouldReturn200AndAllowLoginWithNewPassword()
    {
        // Arrange — simulerer fullført flyt ved å sette SmsPasswordResetVerified direkte i DB
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);
        await SeedSmsVerifiedAsync(user.Email!);

        const string newPassword = "NyttSikkertPassord123!";

        // Act
        var response = await _client.PostAsJsonAsync(
            Endpoints.PasswordReset.ResetPassword,
            new ResetPasswordRequest { Email = user.Email!, NewPassword = newPassword });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verifiser at brukeren kan logge inn med nytt passord
        var id = Interlocked.Increment(ref _testCounter);
        var loginClient = _factory.CreateClientWithIp($"10.11.0.{id}");
        loginClient.DefaultRequestHeaders.TryAddWithoutValidation(
            "User-Agent", $"Mozilla/5.0 Chrome/{id * 100 + 110000}.0 ResetPasswordTest");

        var loginResponse = await loginClient.PostAsJsonAsync(
            Endpoints.Auth.Login,
            new LoginRequest
            {
                Email    = user.Email!,
                Password = newPassword,
                Device   = new DeviceInfoRequest
                {
                    DeviceFingerprint = Guid.NewGuid().ToString(),
                    DeviceName        = TestConstants.Devices.DefaultDeviceName,
                    DeviceType        = DeviceType.Unknown,
                    OperatingSystem   = OperatingSystemType.Unknown,
                },
            });

        loginResponse.EnsureSuccessStatusCode();
    }

    // ======================== 400 Bad Request — ingen session ========================

    [Fact]
    public async Task ResetPassword_WithoutSmsVerified_ShouldReturn400()
    {
        // Arrange — hopper direkte til steg 4 uten å ha gjennomført steg 1–3b
        // SmsPasswordResetVerified er false (standard etter SeedUserWithManagerAsync)
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        // Act
        var response = await _client.PostAsJsonAsync(
            Endpoints.PasswordReset.ResetPassword,
            new ResetPasswordRequest { Email = user.Email!, NewPassword = "NyttSikkertPassord123!" });

        // Assert — IsSmsPasswordResetVerifiedAsync returnerer ResetSessionNotVerified (5001) → 400
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.ResetSessionNotVerified);
    }

    // ======================== 422 Unprocessable — svakt passord ========================

    [Fact]
    public async Task ResetPassword_WithWeakPassword_ShouldReturn422WithInvalidRegistrationData()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        await _factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);
        await SeedSmsVerifiedAsync(user.Email!);

        // Act — passord oppfyller ikke Identity-reglene (mangler stor bokstav og tall)
        var response = await _client.PostAsJsonAsync(
            Endpoints.PasswordReset.ResetPassword,
            new ResetPasswordRequest { Email = user.Email!, NewPassword = "svaktpassord" });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);

        var problem = await response.Content.ReadFromJsonAsync<AppProblemDetails>(JsonOpts);
        problem!.Code.Should().Be((int)AppErrorCode.InvalidRegistrationData);
    }
}
