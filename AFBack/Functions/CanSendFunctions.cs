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
    
    public static async Task RemoveCanSendAsync(this DbContext context, int userId, int conversationId)
    {
        var existing = await context.Set<CanSend>()
            .FirstOrDefaultAsync(cs => cs.UserId == userId && cs.ConversationId == conversationId);
            
        if (existing != null)
        {
            context.Set<CanSend>().Remove(existing);
        }
    }
}