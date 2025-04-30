namespace AFBack.Services;

public interface IReactionService
{
    Task AddReactionAsync(int messageId, int userId, string emoji);
  
}