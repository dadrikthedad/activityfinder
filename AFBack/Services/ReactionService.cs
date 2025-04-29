using AFBack.Data;
using AFBack.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Services;

public class ReactionService : IReactionService
{
    private readonly ApplicationDbContext _context;

    public ReactionService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task AddReactionAsync(int messageId, string userId, string emoji)
    {
        var messageExists = await _context.Messages.AnyAsync(m => m.Id == messageId);

        if (!messageExists)
        {
            throw new Exception($"Melding med ID {messageId} eksisterer ikke.");
        }

        var reaction = new Reaction
        {
            MessageId = messageId,
            UserId = userId,
            Emoji = emoji
        };

        _context.Reactions.Add(reaction);
        await _context.SaveChangesAsync();
    }

    public async Task RemoveReactionAsync(int messageId, string userId, string emoji)
    {
        var existingReaction = await _context.Reactions
            .FirstOrDefaultAsync(r => r.MessageId == messageId && r.UserId == userId && r.Emoji == emoji);

        if (existingReaction != null)
        {
            _context.Reactions.Remove(existingReaction);
            await _context.SaveChangesAsync();
        }
    }
}