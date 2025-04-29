namespace AFBack.Services;

public interface IReactionService
{
    Task AddReactionAsync(int messageId, string userId, string emoji);
    Task RemoveReactionAsync(int messageId, string userId, string emoji);
}