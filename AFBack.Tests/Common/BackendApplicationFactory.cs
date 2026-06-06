using AFBack.Common.Results;
using AFBack.Data;
using AFBack.Features.Auth.Models;
using AFBack.Features.FileHandling.Services;
using AFBack.Infrastructure.Constants;
using AFBack.Infrastructure.Email;
using AFBack.Infrastructure.Email.Models;
using AFBack.Infrastructure.KeyVault.Services;
using AFBack.Infrastructure.Sms.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Moq;
using Npgsql;
using Respawn;
using Respawn.Graph;
using StackExchange.Redis;
using Testcontainers.PostgreSql;
using Testcontainers.Redis;

namespace AFBack.Tests.Common;

/// <summary>
/// Starter backend-applikasjonen med ekte PostgreSQL og Redis i Docker-containere.
/// Eksterne tjenester (e-post, SMS, lagring, Vault) erstattes med no-op-mocker.
/// </summary>
public class BackendApplicationFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:17-alpine")
        .Build();

    private readonly RedisContainer _redis = new RedisBuilder("redis:7-alpine")
        .Build();

    private Respawner _respawner = null!;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        // Overstyr konfigurasjon med testverdier — kjorer nar hosten bygges (ved forste tilgang til Services)
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(TestConfiguration.Build(
                _postgres.GetConnectionString(),
                _redis.GetConnectionString()));
        });

        // Erstatt eksterne tjenester med no-op-mocker slik at ingen ekte HTTP-kall gjores.
        // Merk: Result er en klasse — Mock.Of<>() returnerer null for Task<Result>.
        // Epost- og SMS-mocker maa eksplisitt settes opp til aa returnere Result.Success().
        builder.ConfigureServices(services =>
        {
            var emailMock = new Mock<IEmailService>();
            emailMock
                .Setup(s => s.SendAsync(
                    It.IsAny<string>(),
                    It.IsAny<EmailBody>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(Result.Success());

            services.RemoveAll<IEmailService>();
            services.AddScoped(_ => emailMock.Object);

            var smsMock = new Mock<ISmsService>();
            smsMock
                .Setup(s => s.SendAsync(
                    It.IsAny<string>(),
                    It.IsAny<string>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(Result.Success());

            services.RemoveAll<ISmsService>();
            services.AddScoped(_ => smsMock.Object);

            // Lagring og Vault kalles ikke i auth-flyten — Mock.Of<> er tilstrekkelig
            services.RemoveAll<IStorageService>();
            services.AddScoped(_ => Mock.Of<IStorageService>());

            services.RemoveAll<IKeyVaultService>();
            services.AddScoped(_ => Mock.Of<IKeyVaultService>());

        });
    }

    public async Task InitializeAsync()
    {
        // Start containere — ma skje for Services aksesseres
        await Task.WhenAll(_postgres.StartAsync(), _redis.StartAsync());

        // Forste tilgang til Services bygger hosten, kjorer Program.cs (inkl. MigrateAsync),
        // og starter hosted services. Migrasjoner er ferdig innen hosted services starter.
        await using var scope = Services.CreateAsyncScope();

        // Sett opp Respawn for a nullstille databasen mellom tester
        await using var connection = new NpgsqlConnection(_postgres.GetConnectionString());
        await connection.OpenAsync();

        _respawner = await Respawner.CreateAsync(connection, new RespawnerOptions
        {
            DbAdapter = DbAdapter.Postgres,
            SchemasToInclude = ["public"],
            // Bevar roller og rollerettigheter — disse er seeda av migrasjonene
            // og MigrateAsync kjøres kun én gang per fabrikk-instans.
            TablesToIgnore =
            [
                new Table("__EFMigrationsHistory"),
                new Table("AspNetRoles"),
                new Table("AspNetRoleClaims"),
            ],
        });
    }

    /// <summary>
    /// Legg inn testdata via EF Core. Bruk i stedet for raa SQL.
    /// </summary>
    public async Task SeedAsync(Func<AppDbContext, Task> seed)
    {
        await using var scope = Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await seed(db);
    }

    /// <summary>
    /// Oppretter en testbruker via UserManager slik at passordet hashes korrekt og rollen tildeles.
    /// Oppretter ogsa en tom VerificationInfo som trengs av login-flyten (MFA-koder).
    /// </summary>
    public async Task SeedUserWithManagerAsync(AppUser user, string password)
    {
        await using var scope = Services.CreateAsyncScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var db          = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var result = await userManager.CreateAsync(user, password);
        if (!result.Succeeded)
            throw new InvalidOperationException(
                $"Kunne ikke opprette testbruker: {string.Join(", ", result.Errors.Select(e => e.Description))}");

        await userManager.AddToRoleAsync(user, AppRoles.User);

        // VerificationInfo opprettes normalt av signup-flyten og trengs for at login-flyten
        // skal kunne lagre og lese MFA-koder.
        db.VerificationInfos.Add(new VerificationInfo { UserId = user.Id });
        await db.SaveChangesAsync();
    }

    /// <summary>
    /// Kjorer en sporing mot databasen og returnerer resultatet.
    /// Bruk for a lese testdata etter API-kall (f.eks. hente MFA-kode eller verifisere sideeffekter).
    /// </summary>
    public async Task<T> QueryAsync<T>(Func<AppDbContext, Task<T>> query)
    {
        await using var scope = Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await query(db);
    }

    /// <summary>
    /// Nullstiller alle tabeller unntatt migrasjonshistorikk.
    /// Kall i hver tests DisposeAsync.
    /// </summary>
    public async Task ResetDatabaseAsync()
    {
        await using var connection = new NpgsqlConnection(_postgres.GetConnectionString());
        await connection.OpenAsync();
        await _respawner.ResetAsync(connection);
    }

    /// <summary>
    /// Tommer Redis-cachen.
    /// </summary>
    public async Task ResetRedisAsync()
    {
        var options = ConfigurationOptions.Parse(_redis.GetConnectionString());
        options.AllowAdmin = true;
        await using var multiplexer = await ConnectionMultiplexer.ConnectAsync(options);
        var server = multiplexer.GetServer(multiplexer.GetEndPoints().First());
        await server.FlushDatabaseAsync();
    }

    /// <summary>
    /// Returnerer en klient som alltid sender X-Forwarded-For: 127.0.0.1,
    /// slik at IpBanMiddleware ikke blokkerer testrequester uten RemoteIpAddress.
    /// </summary>
    public HttpClient CreateClientWithIp(string ip = "127.0.0.1")
    {
        var client = CreateDefaultClient(new IpForwardingHandler(ip));
        return client;
    }

    public new async Task DisposeAsync()
    {
        await _postgres.DisposeAsync();
        await _redis.DisposeAsync();
    }

    private sealed class IpForwardingHandler(string ip) : DelegatingHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
        {
            request.Headers.TryAddWithoutValidation("X-Forwarded-For", ip);
            return base.SendAsync(request, cancellationToken);
        }
    }
}
