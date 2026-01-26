using AFBack.Cache;
using AFBack.Features.Cache.Interface;
using AFBack.Features.CanSend.Models;
using AFBack.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Functions;

public static class CanSendFunctions
{
    public static async Task<bool> CanUserSendAsync(this DbContext context, int userId, int conversationId)
    {
        return await context.Set<CanSend>()
            .AsNoTracking()
            .AnyAsync(cs => cs.UserId == userId && cs.ConversationId == conversationId);
    }
    
    public static async Task AddCanSendAsync(this DbContext context, int userId, int conversationId, CanSendReason reason = CanSendReason.MessageRequest)
    {
        var existing = await context.Set<CanSend>()
            .FirstOrDefaultAsync(cs => cs.UserId == userId && cs.ConversationId == conversationId);
            
        if (existing == null)
        {
            context.Set<CanSend>().Add(new CanSend
            {
                UserId = userId,
                ConversationId = conversationId,
                Reason = reason,
                ApprovedAt = DateTime.UtcNow,
                LastUpdated = DateTime.UtcNow
            });
        }
    }
    
    // 🆕 Overload som også håndterer cache
    public static async Task AddCanSendAsync(this DbContext context, int userId, int conversationId, 
        ISendMessageCache cache, CanSendReason reason = CanSendReason.MessageRequest)
    {
        var existing = await context.Set<CanSend>()
            .FirstOrDefaultAsync(cs => cs.UserId == userId && cs.ConversationId == conversationId);
        
        if (existing == null)
        {
            var canSend = new CanSend
            {
                UserId = userId,
                ConversationId = conversationId,
                Reason = reason,
                ApprovedAt = DateTime.UtcNow,
                LastUpdated = DateTime.UtcNow
            };
        
            context.Set<CanSend>().Add(canSend);
        
            // 🆕 Invalidere cache i stedet for å oppdatere den
            cache.InvalidateUserConversationCache(userId, conversationId);
        }
    }
    
    // 🆕 Bulk add for multiple users med cache
    public static async Task AddMultipleCanSendAsync(this DbContext context, 
        List<(int userId, int conversationId, CanSendReason reason)> entries,
        ISendMessageCache cache)
    {
        var canSendEntries = new List<CanSend>();
        
        foreach (var (userId, conversationId, reason) in entries)
        {
            var existing = await context.Set<CanSend>()
                .FirstOrDefaultAsync(cs => cs.UserId == userId && cs.ConversationId == conversationId);
                
            if (existing == null)
            {
                var canSend = new CanSend
                {
                    UserId = userId,
                    ConversationId = conversationId,
                    Reason = reason,
                    ApprovedAt = DateTime.UtcNow,
                    LastUpdated = DateTime.UtcNow
                };
                
                context.Set<CanSend>().Add(canSend);
                canSendEntries.Add(canSend);
                
                // Oppdater cache
                await cache.OnCanSendAddedAsync(userId, conversationId, canSend);
            }
        }
    }
    
    public static async Task RemoveCanSendAsync(this DbContext context, int userId, int conversationId)
    {
        var existing = await context.Set<CanSend>()
            .FirstOrDefaultAsync(cs => cs.UserId == userId && cs.ConversationId == conversationId);
            
        if (existing != null)
        {
            context.Set<CanSend>().Remove(existing);
        }
    }
    
    // 🆕 Overload med cache
    public static async Task RemoveCanSendAsync(this DbContext context, int userId, int conversationId, 
        ISendMessageCache cache)
    {
        var existing = await context.Set<CanSend>()
            .FirstOrDefaultAsync(cs => cs.UserId == userId && cs.ConversationId == conversationId);
        
        if (existing != null)
        {
            context.Set<CanSend>().Remove(existing);
        
            // 🆕 Invalidere cache
            cache.InvalidateUserConversationCache(userId, conversationId);
        }
    }
}