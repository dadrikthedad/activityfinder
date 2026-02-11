using AFBack.Data;
using AFBack.Infrastructure.Security.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Infrastructure.Security.Repositories;

public class SuspiciousActivityRepository(AppDbContext context) : ISuspiciousActivityRepository
{
    /// <inheritdoc />
    public async Task<int> GetSuspiciousActivitiesCountAsync(string ipAddress, DateTime suspiciousWindowStart) =>
        await context.SuspiciousActivities
            .Where(a => a.IpAddress == ipAddress && a.Timestamp > suspiciousWindowStart)
            .CountAsync();
    
    /// <inheritdoc />
    public async Task AddSuspiciousActivity(SuspiciousActivity suspiciousActivity)
    {
        await context.SuspiciousActivities.AddAsync(suspiciousActivity);
        await context.SaveChangesAsync();
    }
}
