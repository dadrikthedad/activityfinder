using AFBack.Data;
using AFBack.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Interface.Repository;

public class ConversationRepository(ApplicationDbContext context) : IConversationRepository
{
    /// <summary>
    /// Henter en samtale fra databasen med participants
    /// </summary>
    /// <param name="conversationId"></param>
    /// <returns></returns>
    public async Task<Conversation?> GetConversation(int conversationId) => await context.Conversations
        .Include(conversation => conversation.Participants)
        .AsNoTracking()
        .FirstOrDefaultAsync(conversation => conversation.Id == conversationId);
    
    
    /// <summary>
    /// Henter en samtale fra databasen med participants og tilhørende bruker-objekter
    /// </summary>
    /// <param name="conversationId"></param>
    /// <returns></returns>
    public async Task<Conversation?> GetConversationWithUsers(int conversationId) => await context.Conversations
        .Include(conversation => conversation.Participants)
            .ThenInclude(p => p.User)
        .AsNoTracking()
        .FirstOrDefaultAsync(conversation => conversation.Id == conversationId);


}