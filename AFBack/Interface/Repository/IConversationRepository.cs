using AFBack.Models;

namespace AFBack.Interface.Repository;

public interface IConversationRepository
{
    Task<Conversation?> GetConversation(int conversationId);
    Task<Conversation?> GetConversationWithUsers(int conversationId);
}
