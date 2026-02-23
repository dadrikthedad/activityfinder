using AFBack.Features.Settings.Models;

namespace AFBack.Features.Settings.Repositories;

public interface ISettingsRepository
{
    // 
    Task<UserSettings?> GetByUserIdAsync(string userId);
    Task SaveChangesAsync();
}
