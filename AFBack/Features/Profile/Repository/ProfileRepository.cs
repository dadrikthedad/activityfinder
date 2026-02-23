using AFBack.Data;
using AFBack.Features.Profile.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.Profile.Repository;

public class ProfileRepository(AppDbContext context) : IProfileRepository
{
    /// <inheritdoc/>
    public async Task<UserProfile?> GetProfileByUserAsync(string userId) => 
        await context.Profiles.FirstOrDefaultAsync(p => p.UserId == userId);
    
    /// <inheritdoc/>
    public async Task<UserProfile?> GetProfileWithNavigationsAsync(string userId) =>
        await context.Profiles
            .Include(p => p.AppUser!)
            .ThenInclude(u => u.UserSettings)
            .FirstOrDefaultAsync(p => p.UserId == userId);

    public async Task SaveChangesAsync() => await context.SaveChangesAsync();
}
