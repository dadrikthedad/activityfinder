using AFBack.Data;
using AFBack.Interface.Repository;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Repository;
public class CanSendRepository(ApplicationDbContext context) : ICanSendRepository
{
    /// <summary>
    /// Sjekker raskt om brukeren og samtalen er i CanSend
    /// </summary>
    /// <param name="userId"></param>
    /// <param name="conversationId"></param>
    /// <returns></returns>
    public async Task<bool> CanSendExistsAsync(string userId, int conversationId) =>
        await context.CanSend
            .AsNoTracking()
            .AnyAsync(cs => cs.UserId == userId && cs.ConversationId == conversationId);
}
