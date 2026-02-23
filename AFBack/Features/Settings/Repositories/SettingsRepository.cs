using AFBack.Data;
using AFBack.Features.Settings.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.Settings.Repositories;

public class SettingsRepository(AppDbContext context) : ISettingsRepository
{
    /// <inheritdoc/>
    public async Task<UserSettings?> GetByUserIdAsync(string userId) =>
        await context.UserSettings.FirstOrDefaultAsync(s => s.UserId == userId);
    
    /// <inheritdoc/>
    public async Task SaveChangesAsync() =>
        await context.SaveChangesAsync();
}
