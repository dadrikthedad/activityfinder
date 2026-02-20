using AFBack.Features.Auth.Repositories;

namespace AFBack.Infrastructure.Cleanup.Tasks;

/// <summary>
/// Rydder opp gamle og utgåtte tokens
/// </summary>
public class ExpiredTokenCleanupTask(
    IServiceScopeFactory scopeFactory,
    ILogger<ExpiredTokenCleanupTask> logger) : ICleanupTask
{
    public string TaskName => "ExpiredTokenCleanup";
    public TimeSpan Interval => TimeSpan.FromHours(24);
    public TimeSpan InitialDelay => TimeSpan.FromMinutes(10);

    public async Task ExecuteAsync(CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var tokenRepository = scope.ServiceProvider.GetRequiredService<IRefreshTokenRepository>();

        var now = DateTime.UtcNow;
        var revokedBefore = now.AddDays(-30);

        var deletedCount = await tokenRepository.DeleteExpiredAndOldRevokedAsync(now, 
            revokedBefore, cancellationToken);

        if (deletedCount > 0)
            logger.LogInformation("Cleaned up {Count} expired/revoked refresh tokens", deletedCount);
    }
}
