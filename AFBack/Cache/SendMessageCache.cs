using System.Collections;
using AFBack.Data;
using AFBack.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

public class SendMessageCache
{
    private readonly IMemoryCache _cache;
    private readonly ApplicationDbContext _ctx;

    public SendMessageCache(IMemoryCache cache, ApplicationDbContext ctx)
        => (_cache, _ctx) = (cache, ctx);

    /// <summary>
    /// Sjekker om en bruker kan sende meldinger til en samtale (med cache)
    /// </summary>
    public Task<bool> CanUserSendAsync(int userId, int conversationId)
        => _cache.GetOrCreateAsync(
            key: $"cansend:{userId}:{conversationId}",
            factory: async entry =>
            {
                entry.SlidingExpiration = TimeSpan.FromMinutes(5);
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(30);

                return await _ctx.CanSend
                    .AsNoTracking()
                    .AnyAsync(cs => cs.UserId == userId && cs.ConversationId == conversationId);
            });

    /// <summary>
    /// Henter alle samtaler en bruker kan sende til (med cache)
    /// </summary>
    public Task<List<int>?> GetUserCanSendConversationsAsync(int userId)
        => _cache.GetOrCreateAsync(
            key: $"cansend:user:{userId}",
            factory: async entry =>
            {
                entry.SlidingExpiration = TimeSpan.FromMinutes(10);
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(1);

                return await _ctx.CanSend
                    .AsNoTracking()
                    .Where(cs => cs.UserId == userId)
                    .Select(cs => cs.ConversationId)
                    .ToListAsync();
            });

    /* --------- Hjelpemetoder for å oppdatere cache når data endres --------- */
    
    /// <summary>
    /// Oppdaterer cache når en ny CanSend legges til
    /// </summary>
    public async Task OnCanSendAddedAsync(int userId, int conversationId, CanSend canSend)
    {
        // Sett verdier direkte i cache for raskere oppslag
        _cache.Set($"cansend:{userId}:{conversationId}", true, TimeSpan.FromMinutes(5));
        _cache.Set($"cansend:details:{userId}:{conversationId}", canSend, TimeSpan.FromMinutes(5));
        
        // Invalidér lister så de hentes på nytt
        _cache.Remove($"cansend:user:{userId}");
        _cache.Remove($"cansend:conv:{conversationId}");
    }

    /// <summary>
    /// Oppdaterer cache når en CanSend fjernes
    /// </summary>
    public void OnCanSendRemoved(int userId, int conversationId)
    {
        // Sett false i cache for raskere oppslag
        _cache.Set($"cansend:{userId}:{conversationId}", false, TimeSpan.FromMinutes(5));
        _cache.Remove($"cansend:details:{userId}:{conversationId}");
        
        // Invalidér lister
        _cache.Remove($"cansend:user:{userId}");
        _cache.Remove($"cansend:conv:{conversationId}");
    }
}