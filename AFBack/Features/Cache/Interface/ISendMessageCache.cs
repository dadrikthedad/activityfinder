using AFBack.Models;

namespace AFBack.Features.Cache.Interface;

public interface ISendMessageCache
{
    Task<bool> CanUserSendAsync(int userId, int conversationId);
    Task<List<int>?> GetUserCanSendConversationsAsync(int userId);
    Task<Conversation?> GetConversationIfUserCanSendAsync(int userId, int conversationId);
    Task OnCanSendAddedAsync(int userId, int conversationId, CanSend canSend);
    void OnCanSendRemoved(int userId, int conversationId);
    void InvalidateUserConversationCache(int userId, int conversationId);
} 
