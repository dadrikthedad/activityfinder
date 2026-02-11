using System.Text.Json;
using AFBack.DTOs;
using AFBack.Features.Auth.Repositories;
using Microsoft.Extensions.Caching.Distributed;

namespace AFBack.Cache;

public class UserSummaryCacheService(
    IDistributedCache cache,
    IServiceProvider serviceProvider,
    ILogger<UserSummaryCacheService> logger,
    IConfiguration configuration) : IUserSummaryCacheService
{
    private const string CACHE_KEY_PREFIX = "user:summary:";
    private readonly bool _cachingEnabled = configuration.GetValue<bool>("CacheSettings:EnableCaching", true);
    
    // Metrics for måling
    private long _cacheHits;
    private long _cacheMisses;
    private long _cacheRefreshes;
    
    // ==================== Hente fra cache/database ====================
    
    public async Task<UserSummaryDto?> GetUserSummaryAsync(string userId)
    {
        if (!_cachingEnabled)
        {
            using var scope = serviceProvider.CreateScope();
            var userRepository = scope.ServiceProvider.GetRequiredService<IUserRepository>();
            return await userRepository.GetUserSummaryAsync(userId);
        }

        var cacheKey = $"{CACHE_KEY_PREFIX}{userId}";

        try
        {
            // 1. Prøver å hente fra cache først
            var cached = await cache.GetStringAsync(cacheKey);
            if (cached != null)
            {
                Interlocked.Increment(ref _cacheHits);
                logger.LogDebug("Cache HIT for user {UserId}", userId);

                return JsonSerializer.Deserialize<UserSummaryDto>(cached);
            }

            // 2. Cache miss - laster fra databasen
            Interlocked.Increment(ref _cacheMisses);
            logger.LogDebug("Cache MISS for user {UserId} - loading from database", userId);

            using var scope = serviceProvider.CreateScope();
            var userRepository = scope.ServiceProvider.GetRequiredService<IUserRepository>();
            var user = await userRepository.GetUserSummaryAsync(userId);

            if (user == null)
            {
                logger.LogError("User {UserId} does not exist", userId);
                return null;
            }
            
            // 3. Lagrer UserSummary til cache
            await SetCacheAsync(cacheKey, user);

            return user;
        }
        catch (Exception ex)
        {
            logger.LogError(
                ex, "Error getting user summary from cache for {UserId} - falling back to database", userId);
            
            using var scope = serviceProvider.CreateScope();
            var userRepo = scope.ServiceProvider.GetRequiredService<IUserRepository>();
            return await userRepo.GetUserSummaryAsync(userId);
        }
    }
    
    
    public async Task<Dictionary<string, UserSummaryDto>> GetUserSummariesAsync(List<string> userIds)
    {   
        // Sjekker at det er ikke doble brukere
        var distinctIds = userIds.Distinct().ToList();
        
        // Hvis vi har fått en tom liste, returner en tom dictionary
        if (!distinctIds.Any())
            return new Dictionary<string, UserSummaryDto>();
        
        
        if (!_cachingEnabled)
        {
            using var scope = serviceProvider.CreateScope();
            var userRepository = scope.ServiceProvider.GetRequiredService<IUserRepository>();
            return await userRepository.GetUserSummariesAsync(userIds);
        }
        
        var result = new Dictionary<string, UserSummaryDto>();
        var missingIds = new List<string>();

        try
        {
            // 1. Prøver å hente fra cache først
            var userSummariesFromCacheTask = distinctIds.Select(async userId =>
            {
                var cacheKey = $"{CACHE_KEY_PREFIX}{userId}";
                var cached = await cache.GetStringAsync(cacheKey);
                return new { UserId = userId, Cached = cached };
            });

            var cacheResults = await Task.WhenAll(userSummariesFromCacheTask);

            foreach (var cacheResult in cacheResults)
            {
                if (cacheResult.Cached != null)
                {
                    var summary = JsonSerializer.Deserialize<UserSummaryDto>(cacheResult.Cached);
                    if (summary != null)
                    {
                        result[cacheResult.UserId] = summary;
                        Interlocked.Increment(ref _cacheHits);
                    }
                }
                else
                {
                    missingIds.Add(cacheResult.UserId);
                    Interlocked.Increment(ref _cacheMisses);
                }
            }
            
            logger.LogDebug("Getting batch of UserSummaries: {Hits} cache hits, {Misses} cache misses", 
                result.Count, missingIds.Count);

            // 2. Hent kun de som ikke var i cache eller alle fra databasen
            if (missingIds.Any())
            {
                using var scope = serviceProvider.CreateScope();
                var userRepository = scope.ServiceProvider.GetRequiredService<IUserRepository>();
                var userSummaries = await userRepository.GetUserSummariesAsync(missingIds);

                var userSummariesFromDbTask = userSummaries.Select(async kvp =>
                {
                    result[kvp.Key] = kvp.Value;
                    await SetCacheAsync($"{CACHE_KEY_PREFIX}{kvp.Key}", kvp.Value);
                });

                await Task.WhenAll(userSummariesFromDbTask);

                logger.LogInformation("Cached {Count} new users from database", userSummaries.Count);
            }

            return result;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error in bulk user summary fetch - falling back to database");
            
            using var scope = serviceProvider.CreateScope();
            var userRepo = scope.ServiceProvider.GetRequiredService<IUserRepository>();
            return await userRepo.GetUserSummariesAsync(distinctIds);
        }
    }
    
    // ==================== Sette til cache ====================
    
    /// <summary>
    /// Setter en bruker til cache - for alltid
    /// </summary>
    /// <param name="key">Cache-nøkkelen for å finne brukeren</param>
    /// <param name="user">UserSummary til brukeren</param>
    private async Task SetCacheAsync(string key, UserSummaryDto user)
    {
        var json = JsonSerializer.Serialize(user);

        await cache.SetStringAsync(key, json, new DistributedCacheEntryOptions
        {
            AbsoluteExpiration = DateTimeOffset.MaxValue
        });
    }
    
    // ==================== Invalidere ====================
    
    /// <summary>
    /// Invaliderer en brukers UserSummary
    /// </summary>
    public async Task InvalidateUserSummaryAsync(string userId)
    {
        if (!_cachingEnabled)
            return;

        try
        {
            var cacheKey = $"{CACHE_KEY_PREFIX}{userId}";
            await cache.RemoveAsync(cacheKey);

            logger.LogInformation("Invalidated cache for user {UserId}", userId);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error invalidating cache for user {UserId}", userId);
        }
    }
    
    // ==================== Refreshe ====================
    public async Task RefreshUserSummaryAsync(string userId)
    {
        if (!_cachingEnabled)
            return;

        try
        {
            using var scope = serviceProvider.CreateScope();
            var userRepo = scope.ServiceProvider.GetRequiredService<IUserRepository>();
            var user = await userRepo.GetUserSummaryAsync(userId);

            if (user != null)
            {
                var cacheKey = $"{CACHE_KEY_PREFIX}{userId}";
                await SetCacheAsync(cacheKey, user);

                Interlocked.Increment(ref _cacheRefreshes);
                logger.LogInformation("Refreshed cache for user {UserId}", userId);
            }
            else
            {
                await InvalidateUserSummaryAsync(userId);
                logger.LogError("User {UserId} does not exist - removed from cache if exists in cache", userId);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error refreshing cache for user {UserId}", userId);
        }
    }
}
