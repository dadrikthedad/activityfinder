using AFBack.Configurations.Options;
using AFBack.Infrastructure.Security.Services;
using AFBack.Services;

namespace AFBack.Infrastructure.Cleanup.Tasks;

/// <summary>
/// Cleanup task for email rate limit data.
/// Rydder utløpte cooldowns, daglige tellere og IP-tellere.
/// Kjøres av MaintenanceCleanupService via ICleanupTask.
/// </summary>
public class EmailRateLimitCleanUpTask(EmailRateLimitService emailRateLimitService)
{
    public string TaskName => "EmailRateLimit";
    public TimeSpan Interval => TimeSpan.FromMinutes(EmailRateConfig.EmailCleanupIntervalMinutes);

    public Task ExecuteAsync(CancellationToken cancellationToken)
    {
        emailRateLimitService.PerformCleanup();
        return Task.CompletedTask;
    }
}
