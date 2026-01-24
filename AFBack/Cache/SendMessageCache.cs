using AFBack.Interface.Repository;
using Microsoft.Extensions.Caching.Distributed;


namespace AFBack.Cache;

public class SendMessageCache(
    IDistributedCache cache,
    IServiceScopeFactory scopeFactory,
    ILogger<SendMessageCache> logger,
    IConfiguration configuration) : ISendMessageCache
{
    private const string CAN_SEND_PREFIX = "cansend:";

    private readonly int _cacheDurationMinutes = configuration.GetValue(
        "CacheSettings:CanSendCacheDurationMinutes", 5);
    
    
    // Metrics for måling
    private long _cacheHits;
    private long _cacheMisses;
    
    
    public async Task<bool> CanUserSendAsync(string userId, int conversationId)
    {

        var cacheKey = $"{CAN_SEND_PREFIX}{userId}:{conversationId}";

        try
        {
            // Sjekk først cache
            var cached = await cache.GetStringAsync(cacheKey);
            if (cached != null)
            {
                Interlocked.Increment(ref _cacheHits);
                logger.LogDebug("Cache HIT for CanSend {UserId}:{ConversationId}", userId, conversationId);

                return bool.Parse(cached);
            }

            Interlocked.Increment(ref _cacheMisses);
            logger.LogDebug("Cache MISS for CanSend {UserId}:{ConversationId}", userId, conversationId);
            
            // Hent fra databasen
            using var scope = scopeFactory.CreateScope();
            var canSendRepository = scope.ServiceProvider.GetRequiredService<ICanSendRepository>();
            var canSend = await canSendRepository.CanSendExistsAsync(userId, conversationId);
            
            // Cache for 5 min
            await cache.SetStringAsync(cacheKey, canSend.ToString(), new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(_cacheDurationMinutes)
            });

            return canSend;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error checking CanSend cache for {UserId}:{ConversationId}",
                userId, conversationId);
            
            // Fallback til database
            using var scope = scopeFactory.CreateScope();
            var canSendRepository = scope.ServiceProvider.GetRequiredService<ICanSendRepository>();
            return await canSendRepository.CanSendExistsAsync(userId, conversationId);
        }
    }

    

    /* --------- Hjelpemetoder for å oppdatere cache når data endres --------- */
    
    public async Task OnCanSendAddedAsync(string userId, int conversationId)
    {
        try
        {
            await cache.SetStringAsync($"{CAN_SEND_PREFIX}{userId}:{conversationId}", "True",
                new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5)
                });

            logger.LogInformation("Cache updated: CanSend added for {UserId}:{ConversationId}", 
                userId, conversationId);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error updating cache after CanSend added");
        }
    }
    
    public async Task OnCanSendRemovedAsync(string userId, int conversationId)
    {
        try
        {
            await cache.SetStringAsync($"{CAN_SEND_PREFIX}{userId}:{conversationId}", "False",
                new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(_cacheDurationMinutes)
                });

            logger.LogInformation("Cache updated: CanSend removed for {UserId}:{ConversationId}", 
                userId, conversationId);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error updating cache after CanSend removed");
        }
    }
}
