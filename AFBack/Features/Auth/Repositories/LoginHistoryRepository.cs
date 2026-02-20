using AFBack.Data;
using AFBack.Features.Auth.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.Auth.Repositories;

public class LoginHistoryRepository(AppDbContext context) : ILoginHistoryRepository
{
    /// <inheritdoc/>
    public Task<LoginHistory?> GetActiveLoginAsync(string userId, int deviceId) =>
        context.LoginHistories
            .Where(lh => lh.UserId == userId) // Filtrerer etter UserId, UserDeviceID og ingen loggouter
            .Where(lh => lh.UserDeviceId == deviceId)
            .Where(lh => lh.LogoutAt == null)
            .OrderByDescending(lh => lh.LoginAt) // Oppdaterer kun den siste
            .FirstOrDefaultAsync();
    
    /// <inheritdoc/>
    public Task<List<LoginHistory>> GetActiveLoginsByUserIdAsync(string userId) =>
        context.LoginHistories
            .Where(lh => lh.UserId == userId)
            .Where(lh => lh.LogoutAt == null)
            .ToListAsync();
    
    public async Task AddAsync(LoginHistory loginHistory)
    {
        await context.LoginHistories.AddAsync(loginHistory);
        await context.SaveChangesAsync();
    }

    public async Task SaveChangesAsync() => await context.SaveChangesAsync();
}
