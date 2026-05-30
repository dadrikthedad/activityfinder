using System.Text;
using System.Text.Json;
using AFBack.Common.Enum;
using AFBack.Common.Results;

namespace AFBack.Infrastructure.KeyVault.Services;

public class KeyVaultService(
    HttpClient httpClient,
    ILogger<KeyVaultService> logger) : IKeyVaultService
{

    private const string MountPath = "af"; // KV-stien til Vault

    /// <inheritdoc/>
    public async Task<Result> StoreRecoverySeedAsync(string userId, string recoverySeed)
    {
        try
        {
            // Fast path per bruker/device — Vault KV v2 versjonerer automatisk
            // Hver gang brukeren bytter nøkkel får vi en ny versjon, historikken beholdes alltid
            var secretPath = $"v1/{MountPath}/data/users/{userId}";

            var payload = new
            {
                data = new
                {
                    key = recoverySeed,
                    contentType = "recovery-seed"
                }
            };

            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await httpClient.PostAsync(secretPath, content);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                logger.LogError(
                    "Failed to store recovery seed in Vault for User {UserId}" +
                    "Status: {Status}. Error: {Error}", userId, response.StatusCode, error);
                return Result.Failure("Failed to store recovery seed", AppErrorCode.InternalError);
            }

            logger.LogInformation(
                "Recovery seed stored in Vault for User {UserId}",
                userId);

            return Result.Success();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to store recovery seed in Vault for User {UserId}", userId);
            return Result.Failure("Failed to store recovery seed", AppErrorCode.InternalError);
        }
    }
}
