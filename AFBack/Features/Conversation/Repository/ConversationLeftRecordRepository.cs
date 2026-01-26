using AFBack.Data;
using AFBack.Features.Conversation.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.Conversation.Repository;

public class ConversationLeftRecordRepository(ApplicationDbContext context) : IConversationLeftRecordRepository 
{
    // Sjekk interface for summary
    public async Task<bool> ExistsAsync(string userId, int conversationId) =>
        await context.ConversationLeftRecords
            .AnyAsync(r => r.UserId == userId && r.ConversationId == conversationId);
    
    
    public async Task<ConversationLeftRecord?> GetAsync(string userId, int conversationId) =>
        await context.ConversationLeftRecords
            .FirstOrDefaultAsync(r => r.UserId == userId && r.ConversationId == conversationId);
    
    // Sjekk interface for summary
    public async Task CreateAsync(ConversationLeftRecord record)
    {
        await context.ConversationLeftRecords.AddAsync(record);
        await context.SaveChangesAsync();
    }

    // Sjekk interface for summary
    public async Task<List<ConversationLeftRecord>> GetByUserIdAsync(string userId) =>
        await context.ConversationLeftRecords
            .AsNoTracking()
            .Where(r => r.UserId == userId)
            .Include(r => r.Conversation)
            .ToListAsync();

    // Sjekk interface for summary
    public async Task DeleteAsync(ConversationLeftRecord record)
    {
        context.ConversationLeftRecords.Remove(record);
        await context.SaveChangesAsync();
    }
}
