using System.Collections;
using AFBack.Data;
using AFBack.Features.Cache.Interface;
using AFBack.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

public class SendMessageCache(IMemoryCache cache, IServiceScopeFactory scopeFactory) : ISendMessageCache
{
    /// <summary>
    /// Sjekker om en bruker kan sende meldinger til en samtale (med cache)
    /// </summary>
    public Task<bool> CanUserSendAsync(int userId, int conversationId)
        => cache.GetOrCreateAsync(
            key: $"cansend:{userId}:{conversationId}",
            factory: async entry =>
            {
                entry.SlidingExpiration = TimeSpan.FromMinutes(5);
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(30);

                using var scope = scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                return await context.CanSend
                    .AsNoTracking()
                    .AnyAsync(cs => cs.UserId == userId && cs.ConversationId == conversationId);
            });

    /// <summary>
    /// Henter alle samtaler en bruker kan sende til (med cache)
    /// </summary>
    public Task<List<int>?> GetUserCanSendConversationsAsync(int userId)
        => cache.GetOrCreateAsync(
            key: $"cansend:user:{userId}",
            factory: async entry =>
            {
                entry.SlidingExpiration = TimeSpan.FromMinutes(10);
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(1);
                
                using var scope = scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                return await context.CanSend
                    .AsNoTracking()
                    .Where(cs => cs.UserId == userId)
                    .Select(cs => cs.ConversationId)
                    .ToListAsync();
            });
    
    /// <summary>
    /// Henter samtalen bruker prøver å sende melding til (med cache)
    /// </summary>
    public Task<Conversation?> GetConversationIfUserCanSendAsync(int userId, int conversationId)
        => cache.GetOrCreateAsync(
            key: $"conversation:cansend:{userId}:{conversationId}",
            factory: async entry =>
            {
                entry.SlidingExpiration = TimeSpan.FromMinutes(10);
                
                using var scope = scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                bool canSend = await context.CanSend
                    .AsNoTracking()
                    .AnyAsync(cs => cs.UserId == userId && cs.ConversationId == conversationId);

                if (!canSend)
                    return null;

                return await context.Conversations
                    .AsNoTracking()
                    .FirstOrDefaultAsync(c => c.Id == conversationId);
            });

    /* --------- Hjelpemetoder for å oppdatere cache når data endres --------- */
    
    /// <summary>
    /// Oppdaterer cache når en ny CanSend legges til
    /// </summary>
    public async Task OnCanSendAddedAsync(int userId, int conversationId, CanSend canSend)
    {
        // Sett verdier direkte i cache for raskere oppslag
        cache.Set($"cansend:{userId}:{conversationId}", true, TimeSpan.FromMinutes(5));
        cache.Set($"cansend:details:{userId}:{conversationId}", canSend, TimeSpan.FromMinutes(5));
        
        // Invalidér lister så de hentes på nytt
        cache.Remove($"cansend:user:{userId}");
        cache.Remove($"cansend:conv:{conversationId}");
    }

    /// <summary>
    /// Oppdaterer cache når en CanSend fjernes
    /// </summary>
    public void OnCanSendRemoved(int userId, int conversationId)
    {
        // Sett false i cache for raskere oppslag
        cache.Set($"cansend:{userId}:{conversationId}", false, TimeSpan.FromMinutes(5));
        cache.Remove($"cansend:details:{userId}:{conversationId}");
        
        // Invalidér lister
        cache.Remove($"cansend:user:{userId}");
        cache.Remove($"cansend:conv:{conversationId}");
    }
    
    /// <summary>
    /// Invaliderer all cache for en bruker og samtale
    /// </summary>
    public void InvalidateUserConversationCache(int userId, int conversationId)
    {
        cache.Remove($"cansend:{userId}:{conversationId}");
        cache.Remove($"cansend:details:{userId}:{conversationId}");
        cache.Remove($"cansend:user:{userId}");
        cache.Remove($"cansend:conv:{conversationId}");
    }
    
}