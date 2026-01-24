namespace AFBack.Interface.Repository;

public interface ICanSendRepository
{
    Task<bool> CanSendExistsAsync(string userId, int conversationId);
}
