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

    /// <summary>
    /// Henter alle brukere som kan sende til en samtale (med cache)
    /// </summary>
    public Task<List<int>?> GetConversationCanSendUsersAsync(int conversationId)
        => _cache.GetOrCreateAsync(
            key: $"cansend:conv:{conversationId}",
            factory: async entry =>
            {
                entry.SlidingExpiration = TimeSpan.FromMinutes(10);
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(1);

                return await _ctx.CanSend
                    .AsNoTracking()
                    .Where(cs => cs.ConversationId == conversationId)
                    .Select(cs => cs.UserId)
                    .ToListAsync();
            });

    /// <summary>
    /// Henter detaljert CanSend info for en bruker i en samtale (med cache)
    /// </summary>
    public Task<CanSend?> GetCanSendDetailsAsync(int userId, int conversationId)
        => _cache.GetOrCreateAsync(
            key: $"cansend:details:{userId}:{conversationId}",
            factory: async entry =>
            {
                entry.SlidingExpiration = TimeSpan.FromMinutes(5);
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(30);

                return await _ctx.CanSend
                    .AsNoTracking()
                    .FirstOrDefaultAsync(cs => cs.UserId == userId && cs.ConversationId == conversationId);
            });

    /* --------- Cache Invalidation --------- */
    
    /// <summary>
    /// Invaliderer cache når CanSend endres for en spesifikk bruker/samtale
    /// </summary>
    public void InvalidateCanSend(int userId, int conversationId)
    {
        _cache.Remove($"cansend:{userId}:{conversationId}");
        _cache.Remove($"cansend:details:{userId}:{conversationId}");
        _cache.Remove($"cansend:user:{userId}");
        _cache.Remove($"cansend:conv:{conversationId}");
    }

    /// <summary>
    /// Invaliderer alle CanSend caches for en bruker
    /// </summary>
    public void InvalidateUserCanSend(int userId)
    {
        _cache.Remove($"cansend:user:{userId}");
        
        // Merk: For å invalidere alle brukerens individuelle CanSend entries,
        // må vi ha en liste over samtaler brukeren er i. Dette kan gjøres ved behov.
    }

    /// <summary>
    /// Invaliderer alle CanSend caches for en samtale
    /// </summary>
    public void InvalidateConversationCanSend(int conversationId)
    {
        _cache.Remove($"cansend:conv:{conversationId}");
        
        // Merk: For å invalidere alle individuelle bruker entries for denne samtalen,
        // må vi ha en liste over brukere i samtalen. Dette kan gjøres ved behov.
    }

    /// <summary>
    /// Bulk invalidering - kjør når CanSend tabellen oppdateres betydelig
    /// </summary>
    public void InvalidateAllCanSend()
    {
        // Ikke ideelt, men nyttig for maintenance/cleanup
        // I produksjon ville du ideelt sett tracke alle cache keys
        if (_cache is MemoryCache mc)
        {
            var field = typeof(MemoryCache).GetField("_coherentState", 
                System.Reflection.BindingFlags.NonPublic | 
                System.Reflection.BindingFlags.Instance);
                
            if (field?.GetValue(mc) is IDictionary cacheState)
            {
                var keysToRemove = new List<object>();
                foreach (DictionaryEntry entry in cacheState)
                {
                    if (entry.Key.ToString()?.StartsWith("cansend:") == true)
                        keysToRemove.Add(entry.Key);
                }
                
                foreach (var key in keysToRemove)
                    _cache.Remove(key);
            }
        }
    }

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