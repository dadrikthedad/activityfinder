namespace AFBack.Tests.Common;

/// <summary>
/// Testverdier som overstyrer appsettings.json under integrasjonstester.
/// Eksterne tjenester far dummy-verdier — selve implementasjonene erstattes med mocker i BackendApplicationFactory.
/// </summary>
public static class TestConfiguration
{
    // Forhandsgenererte 32-byte base64-nokler for JWT-signering i tester
    private const string AccessSigningKey     = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=";
    private const string AccessEncryptionKey  = "AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=";
    private const string RefreshSigningKey    = "AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM=";
    private const string RefreshEncryptionKey = "BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ=";

    public static Dictionary<string, string?> Build(string pgConnectionString, string redisConnectionString) => new()
    {
        // Database
        ["ConnectionStrings:DatabaseConnection"] = pgConnectionString,

        // Redis
        ["ConnectionStrings:Redis"] = redisConnectionString,

        // JWT
        ["Jwt:Key"]                  = "test-jwt-secret-key-for-ci-at-least-32-chars",
        ["Jwt:Issuer"]               = "afback-test",
        ["Jwt:Audience"]             = "afback-test",
        ["Jwt:AccessSigningKey"]     = AccessSigningKey,
        ["Jwt:AccessEncryptionKey"]  = AccessEncryptionKey,
        ["Jwt:RefreshSigningKey"]    = RefreshSigningKey,
        ["Jwt:RefreshEncryptionKey"] = RefreshEncryptionKey,

        // Eksterne tjenester — dummy-verdier slik at tjenestene registreres uten feil.
        // Selve implementasjonene erstattes med mocker i BackendApplicationFactory.ConfigureWebHost.
        ["Storage:BlobAccountUrl"] = "http://localhost:9000",
        ["Storage:AccessKey"]      = "test-access-key",
        ["Storage:SecretKey"]      = "test-secret-key",
        ["Email:ApiKey"]           = "test-email-key",
        ["Sms:ApiUsername"]        = "test-sms-user",
        ["Sms:ApiPassword"]        = "test-sms-pass",
        ["KeyVault:Url"]           = "http://localhost:8200",
        ["KeyVault:Token"]         = "test-vault-token",

        // Diverse
        ["EnableSchedulerJobs"] = "false",
        ["Cors:AllowedOrigins"] = "http://localhost:3000",
    };
}
