using AFBack.Data;
using AFBack.Features.Cache.Interface;
using AFBack.Interface.Repository;
using AFBack.Models;
using AFBack.Models.Auth;
using AFBack.Repository;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace AFBack.Features.Cache;

public class UserCache(
    IMemoryCache cache, 
    IServiceScopeFactory scopeFactory) : IUserCache
{
    /// <summary>
    /// Sjekker om brukeren eksisterer med cache
    /// </summary>
    /// <param name="userId"></param>
    /// <returns></returns>
    public Task<bool> UserExistsAsync(string userId) => 
        cache.GetOrCreateAsync(
            key: $"appUser:exists:{userId}",
            factory: async entry =>
            {
                entry.SlidingExpiration = TimeSpan.FromMinutes(30);
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(4);
                entry.Priority = CacheItemPriority.Normal;

                using var scope = scopeFactory.CreateScope();
                var userRepository = scope.ServiceProvider.GetRequiredService<IUserRepository>();

                return await userRepository.UserExistsAsync(userId);
            }
        );

    
    /// <summary>
    /// Henter bruker objektet med Cache
    /// </summary>
    /// <param name="userId"></param>
    /// <returns></returns>
    public Task<AppUser?> GetUserAsync(string userId) =>
        cache.GetOrCreateAsync(
            key: $"appUser:info:{userId}",
            factory: async entry =>
            {
                entry.SlidingExpiration = TimeSpan.FromMinutes(15);
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(2);
                
                using var scope = scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                return await context.AppUsers.AsNoTracking().FirstOrDefaultAsync(user => user.Id == userId);
            });
    
    
    /// <summary>
    /// Invaldierer brukeren i UserCache
    /// </summary>
    /// <param name="userId"></param>
    public void InvalidateUserCache(string userId)
    {
        cache.Remove($"appUser:exists:{userId}");
        cache.Remove($"appUser:info:{userId}");
    }
}
