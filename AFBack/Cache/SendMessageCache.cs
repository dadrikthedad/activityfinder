using AFBack.Features.CanSend.Models;
using AFBack.Features.CanSend.Repository;
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
    
    // Sjekk interface for summary
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
    // Sjekk interface for summary
    public async Task OnCanSendAddedAsync(string userId, int conversationId)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var canSendRepository = scope.ServiceProvider.GetRequiredService<ICanSendRepository>();
        
            var canSend = new CanSend
            {
                UserId = userId,
                ConversationId = conversationId
            };
        
            await canSendRepository.AddAsync(canSend);
        
            await cache.SetStringAsync($"{CAN_SEND_PREFIX}{userId}:{conversationId}", "True",
                new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(_cacheDurationMinutes)
                });

            logger.LogInformation("CanSend added to database and cache for {UserId}:{ConversationId}", 
                userId, conversationId);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error adding CanSend for {UserId}:{ConversationId}", userId, conversationId);
            throw;
        }
    }
    
    // Sjekk interface for summary
    public async Task OnCanSendRemovedAsync(string userId, int conversationId)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var canSendRepository = scope.ServiceProvider.GetRequiredService<ICanSendRepository>();
        
            await canSendRepository.RemoveAsync(userId, conversationId);
        
            await cache.RemoveAsync($"{CAN_SEND_PREFIX}{userId}:{conversationId}");

            logger.LogInformation("CanSend removed from database and cache for {UserId}:{ConversationId}", 
                userId, conversationId);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error removing CanSend for {UserId}:{ConversationId}", userId, conversationId);
            throw;
        }
    }
    
    // Sjekk interface for summary
    public async Task RemoveAllUsersFromConversationAsync(int conversationId)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var canSendRepository = scope.ServiceProvider.GetRequiredService<ICanSendRepository>();
        
            var userIds = await canSendRepository.GetUserIdsByConversationIdAsync(conversationId);
        
            if (!userIds.Any())
            {
                logger.LogDebug("No users with CanSend found for conversation {ConversationId}", conversationId);
                return;
            }

            foreach (var userId in userIds)
            {
                try
                {
                    await OnCanSendRemovedAsync(userId, conversationId);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Failed to remove CanSend for {UserId}:{ConversationId}", 
                        userId, conversationId);
                }
            }

            logger.LogInformation("Removed CanSend for {Count} users from conversation {ConversationId}", 
                userIds.Count(), conversationId);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to fetch users for CanSend removal from conversation {ConversationId}", 
                conversationId);
            throw;
        }
    }
}
