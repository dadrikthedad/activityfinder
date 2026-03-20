using AFBack.Configurations.Options;
using AFBack.Infrastructure.Security.Services;

namespace AFBack.Infrastructure.Cleanup.Tasks;

/// <summary>
/// Cleanup task for email rate limit data.
/// Rydder utløpte cooldowns, daglige tellere og IP-tellere.
/// Kjøres av MaintenanceCleanupService via ICleanupTask.
/// </summary>
public class EmailRateLimitCleanUpTask(IEmailRateLimitService emailRateLimitService) : ICleanupTask
{
    public string TaskName => "EmailRateLimit";
    public TimeSpan Interval => TimeSpan.FromMinutes(EmailRateConfig.EmailCleanupIntervalMinutes);
    
    public TimeSpan InitialDelay { get; } = TimeSpan.FromMinutes(5);

    public Task ExecuteAsync(CancellationToken cancellationToken)
    {
        emailRateLimitService.PerformCleanup();
        return Task.CompletedTask;
    }
}
