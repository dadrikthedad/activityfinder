using AFBack.Data;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.CanSend.Repository;
public class CanSendRepository(ApplicationDbContext context) : ICanSendRepository
{
    // Sjekk interface for summary
    public async Task<bool> CanSendExistsAsync(string userId, int conversationId) =>
        await context.CanSends
            .AsNoTracking()
            .AnyAsync(cs => cs.UserId == userId && cs.ConversationId == conversationId);
    
    // Sjekk interface for summary
    public async Task AddAsync(Models.CanSend canSend)
    {
        context.CanSends.Add(canSend);
        await context.SaveChangesAsync();
    }
    
    // Sjekk interface for summary
    public async Task RemoveAsync(string userId, int conversationId)
    {
        await context.CanSends
            .Where(cs => cs.UserId == userId && cs.ConversationId == conversationId)
            .ExecuteDeleteAsync();
    }
    
    // Sjekk interface for summary
    public async Task<List<string>> GetUserIdsByConversationIdAsync(int conversationId) =>
        await context.CanSends
            .AsNoTracking()
            .Where(cs => cs.ConversationId == conversationId)
            .Select(cs => cs.UserId)
            .ToListAsync();
}
