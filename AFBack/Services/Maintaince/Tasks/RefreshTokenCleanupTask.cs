using AFBack.Interface;
using AFBack.Services.Maintenance;

namespace AFBack.Services.Maintenance.Tasks;

public class RefreshTokenCleanupTask : CleanupTaskBase
{
    public override string TaskName => "Refresh Token Cleanup";
    public override TimeSpan Interval => TimeSpan.FromHours(6); // Kjør hver 6. time
    public override TimeSpan InitialDelay => TimeSpan.FromMinutes(15); // Liten delay

    public RefreshTokenCleanupTask(
        IServiceProvider serviceProvider, 
        ILogger<RefreshTokenCleanupTask> logger) 
        : base(serviceProvider, logger) { }

    public override Task ExecuteAsync(CancellationToken cancellationToken)
    {
        return RunWithErrorHandlingAsync(async () =>
        {
            var stopwatch = System.Diagnostics.Stopwatch.StartNew();
            
            using var scope = ServiceProvider.CreateScope();
            var authService = scope.ServiceProvider.GetRequiredService<OldAuthService>();
            
            // Bruk den eksisterende metoden
            await authService.CleanupExpiredTokensAsync();
            
            stopwatch.Stop();
            Logger.LogInformation("Refresh token cleanup completed in {Duration}ms", 
                stopwatch.ElapsedMilliseconds);
                
        }, cancellationToken);
    }
}