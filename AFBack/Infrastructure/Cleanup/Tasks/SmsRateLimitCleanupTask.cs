using AFBack.Configurations.Options;
using AFBack.Infrastructure.Security.Services;

namespace AFBack.Infrastructure.Cleanup.Tasks;

/// <summary>
/// Cleanup task for SMS rate limit data.
/// Rydder utløpte cooldowns, daglige tellere og IP-tellere.
/// Kjøres av MaintenanceCleanupService via ICleanupTask.
/// </summary>
public class SmsRateLimitCleanupTask(ISmsRateLimitService smsRateLimitService) : ICleanupTask
{
    public string TaskName => "SmsRateLimit";
    public TimeSpan Interval => TimeSpan.FromMinutes(SmsRateLimitConfig.SmsCleanupIntervalMinutes);

    public TimeSpan InitialDelay { get; } = TimeSpan.FromMinutes(5);

    public Task ExecuteAsync(CancellationToken cancellationToken)
    {
        smsRateLimitService.PerformCleanup();
        return Task.CompletedTask;
    }
}
