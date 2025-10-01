using AFBack.Data;
using AFBack.Features.Cache.Interface;
using AFBack.Models;
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
    public Task<bool> UserExistsAsync(int userId) => 
        cache.GetOrCreateAsync(
            key: $"user:exists:{userId}",
            factory: async entry =>
            {
                entry.SlidingExpiration = TimeSpan.FromMinutes(30);
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(4);
                entry.Priority = CacheItemPriority.Normal;

                using var scope = scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                return await context.Users.AsNoTracking()
                    .AnyAsync(user => user.Id == userId);
            }
        );

    
    /// <summary>
    /// Henter bruker objektet med Cache
    /// </summary>
    /// <param name="userId"></param>
    /// <returns></returns>
    public Task<User?> GetUserAsync(int userId) =>
        cache.GetOrCreateAsync(
            key: $"user:info:{userId}",
            factory: async entry =>
            {
                entry.SlidingExpiration = TimeSpan.FromMinutes(15);
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(2);
                
                using var scope = scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                return await context.Users.AsNoTracking().FirstOrDefaultAsync(user => user.Id == userId);
            });
    
    
    /// <summary>
    /// Invaldierer brukeren i UserCache
    /// </summary>
    /// <param name="userId"></param>
    public void InvalidateUserCache(int userId)
    {
        cache.Remove($"user:exists:{userId}");
        cache.Remove($"user:info:{userId}");
    }
}