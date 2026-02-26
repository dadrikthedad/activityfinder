using AFBack.Data;
using AFBack.Features.Reactions.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.Reactions.Repositories;

public class ReactionRepository(AppDbContext context) : IReactionRepository
{   
    /// <inheritdoc/>
    public async Task<Reaction?> GetUserReactionOnMessageAsync(string userId, int messageId, int conversationId) =>
        await context.Reactions
            .FirstOrDefaultAsync(r => 
                r.UserId == userId && 
                r.MessageId == messageId && 
                r.Message.ConversationId == conversationId &&
                !r.Message.IsDeleted &&
                !r.Message.IsSystemMessage);
    
    /// <inheritdoc/>
    public async Task AddReactionAsync(Reaction reaction) => await context.Reactions.AddAsync(reaction);
    
    /// <inheritdoc/>
    public void RemoveReaction(Reaction reaction) => context.Remove(reaction);
    public async Task SaveChangesAsync() => await context.SaveChangesAsync();
}
