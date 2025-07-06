using AFBack.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

public class SendMessageCache
{
    private readonly IMemoryCache _cache;
    private readonly ApplicationDbContext _ctx;

    public SendMessageCache(IMemoryCache cache, ApplicationDbContext ctx)
        => (_cache, _ctx) = (cache, ctx);

    public Task<bool> IsFriendAsync(int a, int b)
        => _cache.GetOrCreateAsync(
            key:     $"friends:{Math.Min(a,b)}:{Math.Max(a,b)}",
            factory: async entry =>
            {
                entry.SlidingExpiration            = TimeSpan.FromMinutes(2);
                entry.AbsoluteExpirationRelativeToNow ??= TimeSpan.FromMinutes(10);

                return await _ctx.Friends
                    .AsNoTracking()
                    .AnyAsync(f => (f.UserId == a && f.FriendId == b) ||
                                   (f.UserId == b && f.FriendId == a));
            });
    
    /* --------- Blokkering --------- */
    public Task<bool> IsBlockedAsync(int blockerId, int blockedId)
        => _cache.GetOrCreateAsync(
            key:     $"blocks:{blockerId}:{blockedId}",
            factory: async entry =>
            {
                entry.SlidingExpiration            = TimeSpan.FromSeconds(30);
                entry.AbsoluteExpirationRelativeToNow ??= TimeSpan.FromMinutes(10);

                return await _ctx.UserBlock
                    .AsNoTracking()
                    .AnyAsync(b => b.BlockerId == blockerId &&
                                   b.BlockedUserId == blockedId);
            });

    /* (valgfritt) manuell invalidasjon når du blokkerer/av-blokkerer */
    public void InvalidateBlock(int blockerId, int blockedId)
        => _cache.Remove($"blocks:{blockerId}:{blockedId}");
    
    public void InvalidateFriend(int a, int b)
        => _cache.Remove($"friends:{Math.Min(a,b)}:{Math.Max(a,b)}");
}