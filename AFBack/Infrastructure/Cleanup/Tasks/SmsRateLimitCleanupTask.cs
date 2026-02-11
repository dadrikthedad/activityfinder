using AFBack.Configurations.Options;
using AFBack.Infrastructure.Security.Services;

namespace AFBack.Infrastructure.Cleanup.Tasks;

/// <summary>
/// Cleanup task for SMS rate limit data.
/// Rydder utløpte cooldowns, daglige tellere og IP-tellere.
/// Kjøres av MaintenanceCleanupService via ICleanupTask.
/// </summary>
public class SmsRateLimitCleanupTask(SmsRateLimitService smsRateLimitService)
{
    public string TaskName => "SmsRateLimit";
    public TimeSpan Interval => TimeSpan.FromMinutes(SmsRateLimitConfig.SmsCleanupIntervalMinutes);

    public Task ExecuteAsync(CancellationToken cancellationToken)
    {
        smsRateLimitService.PerformCleanup();
        return Task.CompletedTask;
    }
}
