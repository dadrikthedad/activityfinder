using AFBack.Configurations.Options;

using AFBack.Features.Auth.Models;
using AFBack.Features.Auth.Repositories;
using Microsoft.AspNetCore.Identity;
namespace AFBack.Infrastructure.Cleanup.Tasks;

/// <summary>
/// Rydder opp brukere som ikke har verifisert seg selv. Forskjellig lengde om de har
/// verifisert epost, men ikke telefon, eller ingen av delene
/// </summary>

public class UnverifiedUserCleanupTask(
    IServiceScopeFactory scopeFactory,
    ILogger<UnverifiedUserCleanupTask> logger) : ICleanupTask
{
    public string TaskName => "UnverifiedUserCleanup";
    public TimeSpan Interval => TimeSpan.FromHours(UnverifiedUserConfig.CleanupIntervalHours);
    public TimeSpan InitialDelay => TimeSpan.FromMinutes(5);

    public async Task ExecuteAsync(CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var userRepository = scope.ServiceProvider.GetRequiredService<IUserRepository>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        
        var now = DateTime.UtcNow;
    
        // Brukere som ikke har verifisert noe som helst - 48 t
        var nothingVerifiedCutoff = now.Subtract(
            TimeSpan.FromHours(UnverifiedUserConfig.MaxUnverifiedAgeHours)); 
    
        // Brukere som har verifisert e-post, men ikke begge — får 7 dager
        var partiallyVerifiedCutoff = now.Subtract(
            TimeSpan.FromHours(UnverifiedUserConfig.MaxPartiallyVerifiedAgeHours));

        var usersToDelete = await userRepository.GetUnverifiedUsersAsync(
            nothingVerifiedCutoff, partiallyVerifiedCutoff, cancellationToken);

        foreach (var user in usersToDelete)
        {
            await userManager.DeleteAsync(user);
            logger.LogInformation(
                "Deleted unverified user {Email} (EmailConfirmed: {EmailConfirmed}, " +
                "PhoneConfirmed: {PhoneConfirmed}, Created: {Created})",
                user.Email, user.EmailConfirmed, user.PhoneNumberConfirmed, user.CreatedAt);
        }

        if (usersToDelete.Count > 0)
            logger.LogInformation("Cleaned up {Count} unverified users", usersToDelete.Count);
    }
}
