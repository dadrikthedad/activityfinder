using AFBack.Common.Enum;
using AFBack.Common.Results;
using Azure.Security.KeyVault.Secrets;

namespace AFBack.Infrastructure.KeyVault.Services;

public class KeyVaultService(
    SecretClient secretClient,
    ILogger<KeyVaultService> logger) : IKeyVaultService
{
    /// <inheritdoc/>
    public async Task<Result> StoreRecoverySeedAsync(string userId, int deviceId, string key)
    {
        try
        {
            var timestamp = DateTime.UtcNow;
            var secretName = $"user-{userId}-{timestamp:yyyyMMddHHmmss}";

            var secret = new KeyVaultSecret(secretName, key)
            {
                Properties =
                {
                    Tags =
                    {
                        ["userId"] = userId,
                        ["device"] = deviceId.ToString(),
                        ["createdAt"] = timestamp.ToString("O"),
                        ["version"] = timestamp.Ticks.ToString()
                    },
                    ContentType = "recovery-seed"
                }
            };

            await secretClient.SetSecretAsync(secret);
            logger.LogInformation("Recovery seed stored for User {UserId} with device {DeviceId}", userId, deviceId);

            return Result.Success();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to store recovery seed for User {UserId}", userId);
            return Result.Failure("Failed to store recovery seed", ErrorTypeEnum.InternalServerError);
        }
        
    }
}
